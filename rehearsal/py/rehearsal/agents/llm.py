"""One OpenAI-compatible chat client with a provider fallback chain.

A chain is ``provider:model[,provider:model...]``. Rate limits, credit errors,
server errors, and timeouts move to the next entry; the reply records which
provider/model actually answered so evaluations stay attributable.
Provider keys are read server-side only.

An entry may end in ``#minimal``, ``#low``, ``#medium``, ``#high``, ``#xhigh``
or ``#max`` to set ``reasoning_effort`` for that entry only, so a fast role
spends few reasoning tokens.

While a job runs, ``usage`` collects calls, tokens, cost and latency per role.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import threading
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx
import openai

from .. import pricing

log = logging.getLogger(__name__)

PROVIDERS: dict[str, tuple[str, str]] = {
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    "groq": ("https://api.groq.com/openai/v1", "GROQ_API_KEY"),
    "google": ("https://generativelanguage.googleapis.com/v1beta/openai/", "GOOGLE_API_KEY"),
    "openai": ("https://api.openai.com/v1", "OPENAI_API_KEY"),
    "anthropic": ("https://api.anthropic.com/v1/", "ANTHROPIC_API_KEY"),
    "mistral": ("https://api.mistral.ai/v1", "MISTRAL_API_KEY"),
    "xai": ("https://api.x.ai/v1", "XAI_API_KEY"),
    "deepseek": ("https://api.deepseek.com/v1", "DEEPSEEK_API_KEY"),
    "together": ("https://api.together.xyz/v1", "TOGETHER_API_KEY"),
    "fireworks": ("https://api.fireworks.ai/inference/v1", "FIREWORKS_API_KEY"),
    "baseten": ("https://inference.baseten.co/v1", "BASETEN_API_KEY"),
    "cerebras": ("https://api.cerebras.ai/v1", "CEREBRAS_API_KEY"),
    "litellm": ("https://litellm.vision.aivar.app/v1", "LITELLM_API_KEY"),  # a LiteLLM proxy (Claude, Amazon Nova); LITELLM_BASE_URL overrides
    "modal": ("", "MODAL_PROXY_TOKEN_ID"),  # base from MODAL_BASE_URL; key is "<token id>.<token secret>"
    "local": ("", "REHEARSAL_LOCAL_API_KEY"),  # base from REHEARSAL_LOCAL_BASE_URL (vLLM etc.)
    "custom": ("", "REHEARSAL_CUSTOM_API_KEY"),  # base from REHEARSAL_CUSTOM_BASE_URL
}


class LLMError(Exception):
    def __init__(self, *args: Any, reply: LLMReply | None = None):
        super().__init__(*args)
        self.reply = reply  # Completed response retained for caller usage accounting.


def declared() -> dict[str, dict[str, Any]]:
    """Providers a project adds without changing the library: REHEARSAL_PROVIDERS, a JSON object of
    {"name": {"base_url": ..., "api_key_env": ..., "tool_choice": ...}}. ``tool_choice``, when given, is sent on every
    call that offers tools, for an API that accepts only that value."""
    raw = os.environ.get("REHEARSAL_PROVIDERS", "").strip()
    if not raw:
        return {}
    try:
        return {name: {"base_url": str(c["base_url"]), "api_key_env": str(c["api_key_env"]), "tool_choice": c.get("tool_choice")}
                for name, c in json.loads(raw).items()}
    except (json.JSONDecodeError, AttributeError, KeyError, TypeError) as exc:
        raise LLMError(f"REHEARSAL_PROVIDERS must be a JSON object of {{name: {{base_url, api_key_env}}}}: {exc}") from exc


def providers() -> dict[str, tuple[str, str]]:
    """Every provider a chain may name: the built-in ones and the project's declared ones, as (base URL, key setting)."""
    return {**PROVIDERS, **{name: (c["base_url"], c["api_key_env"]) for name, c in declared().items()}}


def base_url(provider: str) -> str:
    """Where a provider is reached; local, custom, litellm and modal read it from the environment."""
    base = providers()[provider][0]
    if provider in ("local", "custom"):
        return os.environ.get(f"REHEARSAL_{provider.upper()}_BASE_URL", "http://127.0.0.1:8001/v1" if provider == "local" else "")
    if provider == "litellm":
        return os.environ.get("LITELLM_BASE_URL", base)
    if provider == "modal":
        return os.environ.get("MODAL_BASE_URL", "")
    return base


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    raw_arguments: str
    error: str | None = None  # JSON decoding problem the agent loop reports back


@dataclass
class LLMReply:
    content: str
    tool_calls: list[ToolCall]
    provider: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    attempts: list[str] = field(default_factory=list)
    raw_tool_calls: list[dict[str, Any]] = field(default_factory=list)  # provider metadata (e.g. thought signatures)
    cost_source: str = "unknown"  # where the price came from: provider-reported, a price list, or an override
    effort: str | None = None  # the reasoning_effort sent with the call (None: the model's default)
    latency_ms: int = 0

    def assistant_message(self) -> dict[str, Any]:
        msg: dict[str, Any] = {"role": "assistant", "content": self.content or ""}
        if self.tool_calls:
            raw = {r.get("id"): r for r in self.raw_tool_calls}
            msg["tool_calls"] = [
                {
                    "id": c.id,
                    "type": "function",
                    "function": {"name": c.name, "arguments": c.raw_arguments or "{}"},
                    **({"extra_content": raw[c.id]["extra_content"]} if raw.get(c.id, {}).get("extra_content") else {}),
                }
                for c in self.tool_calls
            ]
        return msg


EFFORTS = ("minimal", "low", "medium", "high", "xhigh", "max")


def parse_chain(chain: str) -> list[tuple[str, str, str | None]]:
    """``provider:model[#effort]`` entries as (provider, model, reasoning effort)."""
    entries = []
    for part in chain.split(","):
        part = part.strip()
        if not part:
            continue
        part, hashed, flag = part.partition("#")
        provider, sep, model = part.partition(":")
        known = providers()
        if not sep or provider not in known or not model:
            raise LLMError(f"bad model entry {part!r}; expected provider:model with provider in {sorted(known)}")
        if hashed and flag not in EFFORTS:
            raise LLMError(f"bad reasoning effort #{flag} in {part!r}; use one of " + ", ".join(f"#{e}" for e in EFFORTS))
        entries.append((provider, model, flag if hashed else None))
    if not entries:
        raise LLMError("no model is set for this role: set the REHEARSAL_MODEL_* settings (see .env.example)")
    return entries


usage: ContextVar[dict[str, dict[str, Any]] | None] = ContextVar("model_usage", default=None)
_usage_lock = threading.Lock()


def _row() -> dict[str, Any]:
    return {"calls": 0, "prompt_tokens": 0, "completion_tokens": 0, "cost_usd": 0.0, "latency_ms": 0, "models": {}}


def record_call(role: str | None, name: str, *, prompt_tokens: int = 0, completion_tokens: int = 0, cost_usd: float = 0.0, latency_ms: int = 0) -> None:
    """Adds one call to the running job's per-role usage (compiler lanes share one dict across threads). `name` is
    `provider:model[#effort]` for a model, or a service such as `tavily:search`."""
    acc = usage.get()
    if acc is None or not role:
        return
    with _usage_lock:
        row = acc.setdefault(role, _row())
        row["calls"] += 1
        row["prompt_tokens"] += prompt_tokens
        row["completion_tokens"] += completion_tokens
        row["cost_usd"] = round(row["cost_usd"] + cost_usd, 6)
        row["latency_ms"] += latency_ms
        row["models"][name] = row["models"].get(name, 0) + 1


def _record(role: str | None, reply: "LLMReply") -> None:
    name = f"{reply.provider}:{reply.model}" + (f"#{reply.effort}" if reply.effort else "")
    record_call(role, name, prompt_tokens=reply.prompt_tokens, completion_tokens=reply.completion_tokens, cost_usd=reply.cost_usd, latency_ms=reply.latency_ms)


def merge_usage(parts: Any) -> dict[str, dict[str, Any]]:
    """Sums per-role usage from several jobs, for example the shards of one run."""
    out: dict[str, dict[str, Any]] = {}
    for part in parts:
        for role, row in (part or {}).items():
            acc = out.setdefault(role, _row())
            for k in ("calls", "prompt_tokens", "completion_tokens", "latency_ms"):
                acc[k] += row.get(k, 0)
            acc["cost_usd"] = round(acc["cost_usd"] + row.get("cost_usd", 0), 6)
            for name, n in row.get("models", {}).items():
                acc["models"][name] = acc["models"].get(name, 0) + n
    return out


_clients: dict[str, Any] = {}


def _client(provider: str) -> Any:
    if provider not in _clients:
        key_env, base = providers()[provider][1], base_url(provider)
        key = os.environ.get(key_env) or ("local" if provider == "local" else "")
        if provider == "modal":
            secret = os.environ.get("MODAL_PROXY_TOKEN_SECRET", "")
            key = f"{key}.{secret}" if key and secret else ""
        if not key or not base:
            raise LLMError(f"{provider} is not configured ({key_env} / base URL missing)")
        # A short connect timeout makes a dead route (for example a broken IPv6 or NAT64 path) fail fast, so the next
        # address of the host (IPv4) is tried, instead of the call hanging for minutes before the fallback chain moves on.
        timeout = httpx.Timeout(180.0, connect=10.0)
        _clients[provider] = openai.OpenAI(base_url=base, api_key=key, timeout=timeout, max_retries=0)
    return _clients[provider]


def _loads(raw: str) -> tuple[dict[str, Any], str | None]:
    if not raw or not raw.strip():
        return {}, None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        # Common model slip: trailing text after a JSON object.
        m = re.match(r"\s*(\{.*\})", raw, re.S)
        if m:
            try:
                value = json.loads(m.group(1))
            except json.JSONDecodeError as exc:
                return {}, f"arguments are not valid JSON: {exc.msg}"
        else:
            return {}, "arguments are not valid JSON"
    if not isinstance(value, dict):
        return {}, "arguments must be a JSON object"
    return value, None


def _for_provider(messages: list[dict[str, Any]], provider: str) -> list[dict[str, Any]]:
    """Adapts replayed assistant tool calls to the provider receiving them.

    Gemini 3 requires the thought signature it issued with each function call;
    calls that came from another provider get Google's documented bypass value.
    Other providers reject the unknown field, so it is removed for them."""
    out = []
    for m in messages:
        if m.get("role") == "assistant" and m.get("tool_calls"):
            calls = []
            for c in m["tool_calls"]:
                c = dict(c)
                if provider == "google":
                    sig = (c.get("extra_content") or {}).get("google", {}).get("thought_signature")
                    if not sig:
                        c["extra_content"] = {"google": {"thought_signature": "skip_thought_signature_validator"}}
                else:
                    c.pop("extra_content", None)
                calls.append(c)
            m = {**m, "tool_calls": calls}
        out.append(m)
    return out


BILLING_COOLDOWN_S = 600
_billing_blocked: dict[str, float] = {}  # provider -> time until which it is skipped after a billing refusal


def _is_billing(exc: Exception) -> bool:
    text = str(exc).lower()
    return any(k in text for k in ("payment method", "spend limit", "insufficient credit", "credits cannot", "billing", "quota exceeded for", "insufficient_quota"))


def _body_retry_delay(exc: Exception) -> float | None:
    """Google puts the retry window in the error body (RetryInfo.retryDelay = "23s")."""
    m = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", str(exc))
    return float(m.group(1)) if m else None


def _retry_after(exc: Exception) -> float | None:
    resp = getattr(exc, "response", None)
    if resp is not None:
        value = resp.headers.get("retry-after")
        try:
            return float(value) if value else None
        except ValueError:
            return None
    return None


def _sleep(seconds: float, check: Callable[[], None] | None) -> None:
    if check is None:
        time.sleep(seconds)
        return
    deadline = time.monotonic() + seconds
    while True:
        check()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return
        time.sleep(min(1.0, remaining))


def chat(
    chain: str,
    messages: list[dict[str, Any]],
    *,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | None = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    response_json: bool = False,
    check: Callable[[], None] | None = None,
    role: str | None = None,
) -> LLMReply:
    """Asks the first entry of the chain that answers. ``role`` names the caller in the job's usage report."""
    attempts: list[str] = []
    entries = parse_chain(chain)
    for round_ in range(6):
        reply, limited, waits = _try_chain(entries, messages, tools, tool_choice, temperature, max_tokens, response_json, attempts, check=check)
        if reply is not None:
            reply.attempts = attempts
            _record(role, reply)
            return reply
        if not limited:
            break
        # Every provider was rate limited: wait for the advertised window, then retry the chain.
        pause = min(90.0, max([w for w in waits if w] or [15.0 * (round_ + 1)]))
        log.info("all providers rate limited; waiting %.0fs (round %d)", pause, round_ + 1)
        _sleep(pause, check)
    raise LLMError("all models in chain failed: " + " | ".join(attempts[-8:]))


def _try_chain(
    entries: list[tuple[str, str, str | None]],
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
    tool_choice: str | None,
    temperature: float,
    max_tokens: int,
    response_json: bool,
    attempts: list[str],
    check: Callable[[], None] | None = None,
) -> tuple[LLMReply | None, bool, list[float | None]]:
    """One pass over the chain: (reply, every failure was a rate limit/timeout, retry hints)."""
    only_limits = True
    configured = False  # no provider of the chain has a key: waiting cannot help
    waits: list[float | None] = []
    for provider, model, effort in entries:
        if _billing_blocked.get(provider, 0) > time.time():
            only_limits = False
            continue
        quote = pricing.billing_quote(provider, model) if pricing.require_known_prices.get() else None
        if pricing.require_known_prices.get() and quote is None:
            only_limits = False
            attempts.append(f"{provider}:{model} has no usable price; configure REHEARSAL_PRICING_FILE before spending against a budget")
            continue
        for attempt in range(2):
            if check is not None:
                check()
            try:
                client = _client(provider)
            except LLMError as exc:
                # a provider without a key is skipped; it must not stop the chain waiting out a rate limit elsewhere
                attempts.append(f"{provider}:{model} unavailable: {exc}")
                break
            configured = True
            kwargs: dict[str, Any] = {"model": model, "messages": _for_provider(messages, provider), "temperature": temperature, "max_tokens": max_tokens}
            if tools:
                kwargs["tools"] = tools
                # a declared provider may accept one value only; callers that want a tool call offer just that tool and ask for it
                kwargs["tool_choice"] = declared().get(provider, {}).get("tool_choice") or tool_choice or "auto"
            if response_json and not tools:
                kwargs["response_format"] = {"type": "json_object"}
            extra: dict[str, Any] = {}
            if provider == "openrouter":
                extra["usage"] = {"include": True}
            if effort is not None:
                extra["reasoning_effort"] = effort
            if extra:
                kwargs["extra_body"] = extra
            started = time.perf_counter()
            try:
                resp = client.chat.completions.create(**kwargs)
            except (openai.RateLimitError, openai.APITimeoutError, openai.APIConnectionError, openai.InternalServerError) as exc:
                if _is_billing(exc):  # a 429 about money is not a rate limit: waiting will not help
                    only_limits = False
                    attempts.append(f"{provider}:{model} billing: {str(exc)[:200]}")
                    _billing_blocked[provider] = time.time() + BILLING_COOLDOWN_S
                    log.warning("%s refused for billing; skipping it for %ds", provider, BILLING_COOLDOWN_S)
                    break
                wait = _retry_after(exc) or _body_retry_delay(exc)
                waits.append(wait)
                attempts.append(f"{provider}:{model} {exc.__class__.__name__}")
                if attempt == 0 and (wait is None or wait <= 10):
                    _sleep(wait if wait is not None else 3, check)
                    continue
                break
            except openai.APIStatusError as exc:  # 400/401/402/403/404: try the next provider
                only_limits = False
                attempts.append(f"{provider}:{model} HTTP {exc.status_code}: {str(exc)[:300]}")
                break
            if not resp.choices:
                only_limits = False
                attempts.append(f"{provider}:{model} returned no choices")
                break
            choice = resp.choices[0].message
            calls = []
            for tc in choice.tool_calls or []:
                args, err = _loads(tc.function.arguments or "")
                calls.append(ToolCall(tc.id or f"call_{len(calls)}", tc.function.name, args, tc.function.arguments or "", err))
            usage = resp.usage
            reported_cost = getattr(usage, "cost", None) if usage else None
            try:
                cost = float(reported_cost) if reported_cost is not None else 0.0
                if not math.isfinite(cost) or cost < 0:
                    raise ValueError("invalid reported cost")
            except (TypeError, ValueError):
                reported_cost, cost = None, 0.0
            source = "provider-reported" if reported_cost is not None else "unknown"
            if reported_cost is None and usage:
                quote = quote or pricing.billing_quote(provider, model)
                if quote:
                    cost = quote.cost(usage.prompt_tokens or 0, usage.completion_tokens or 0)
                    source = f"{quote.source} ({quote.as_of})"
            reply = LLMReply(
                content=choice.content or "",
                tool_calls=calls,
                provider=provider,
                model=model,
                prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
                cost_usd=cost,
                cost_source=source,
                raw_tool_calls=[tc.model_dump(exclude_none=True) for tc in choice.tool_calls or []],
                effort=effort,
                latency_ms=int((time.perf_counter() - started) * 1000),
            )
            return reply, False, waits
    return None, only_limits and configured, waits


def chat_json(
    chain: str,
    messages: list[dict[str, Any]],
    *,
    temperature: float = 0.2,
    max_tokens: int = 8192,
    check: Callable[[], None] | None = None,
    role: str | None = None,
) -> tuple[Any, LLMReply]:
    """Tolerates fenced JSON; parse failures retain usage in ``LLMError.reply``."""
    reply = chat(chain, messages, temperature=temperature, max_tokens=max_tokens, response_json=True, check=check, role=role)
    text = reply.content.strip()
    m = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if m:
        text = m.group(1)
    start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
    if start < 0:
        raise LLMError(f"model returned no JSON: {reply.content[:300]}", reply=reply)
    try:
        return json.JSONDecoder().raw_decode(text[start:])[0], reply
    except json.JSONDecodeError as exc:
        raise LLMError(f"model returned invalid JSON: {exc}", reply=reply) from exc
