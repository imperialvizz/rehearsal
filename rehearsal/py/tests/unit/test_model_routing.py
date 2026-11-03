"""Model chains: the per-entry reasoning switch, per-role routing in the World Compiler, and per-role usage."""

import json
from types import SimpleNamespace

import pytest

from rehearsal.agents import llm
from rehearsal.compiler import pipeline


def test_reasoning_effort_is_parsed_per_entry():
    assert llm.parse_chain("openai:model-a#xhigh, fireworks:model-b#low ,groq:c") == [
        ("openai", "model-a", "xhigh"), ("fireworks", "model-b", "low"), ("groq", "c", None)]
    with pytest.raises(llm.LLMError, match="#minimal, #low"):
        llm.parse_chain("openai:model-a#deep")
    with pytest.raises(llm.LLMError, match="bad model entry"):
        llm.parse_chain("openai:#high")


class FakeClient:
    def __init__(self, calls):
        self.calls = calls
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        message = SimpleNamespace(content="ok", tool_calls=None)
        usage = SimpleNamespace(prompt_tokens=10, completion_tokens=5)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)


@pytest.fixture
def fake(monkeypatch):
    calls = []
    monkeypatch.setattr(llm, "_client", lambda provider: FakeClient(calls))
    monkeypatch.setattr(llm.pricing, "billing_quote", lambda provider, model: None)
    return calls


def test_reasoning_effort_is_sent_only_to_the_flagged_entry(fake):
    llm.chat("openai:model-a#minimal", [{"role": "user", "content": "hi"}])
    llm.chat("groq:openai/gpt-oss-20b", [{"role": "user", "content": "hi"}])
    assert fake[0]["extra_body"] == {"reasoning_effort": "minimal"}
    assert "extra_body" not in fake[1]  # another provider never receives a parameter it may reject


def test_a_project_declares_its_own_provider_and_can_pin_tool_choice(fake, monkeypatch):
    house = {"base_url": "https://llm.example/v1", "api_key_env": "HOUSE_KEY", "tool_choice": "auto"}
    monkeypatch.setenv("REHEARSAL_PROVIDERS", json.dumps({"house": house}))
    assert llm.providers()["house"] == ("https://llm.example/v1", "HOUSE_KEY") and llm.base_url("house") == "https://llm.example/v1"
    tool = {"type": "function", "function": {"name": "submit", "parameters": {"type": "object", "properties": {}}}}
    llm.chat("house:model-a", [{"role": "user", "content": "hi"}], tools=[tool], tool_choice="required")
    llm.chat("groq:openai/gpt-oss-20b", [{"role": "user", "content": "hi"}], tools=[tool], tool_choice="required")
    assert fake[0]["tool_choice"] == "auto"  # an API that rejects "required" never receives it
    assert fake[1]["tool_choice"] == "required"
    monkeypatch.setenv("REHEARSAL_PROVIDERS", "{not json")
    with pytest.raises(llm.LLMError, match="REHEARSAL_PROVIDERS"):
        llm.parse_chain("house:model-a")


def test_a_provider_without_a_key_does_not_stop_waiting_out_a_rate_limit(monkeypatch):
    import httpx
    import openai

    calls = []

    def create(**kwargs):
        calls.append(kwargs["model"])
        if len(calls) <= 2:  # both tries of the first round are rate limited
            raise openai.RateLimitError("slow down", response=httpx.Response(429, request=httpx.Request("POST", "https://x")), body=None)
        return FakeClient([]).create(**kwargs)

    def client(provider):
        if provider == "baseten":
            raise llm.LLMError("baseten is not configured")
        return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

    monkeypatch.setattr(llm, "_client", client)
    monkeypatch.setattr(llm, "_sleep", lambda seconds, check=None: None)
    monkeypatch.setattr(llm.pricing, "billing_quote", lambda provider, model: None)
    reply = llm.chat("baseten:model-b,openai:model-a", [{"role": "user", "content": "hi"}])
    assert reply.provider == "openai" and len(calls) == 3


def test_usage_is_collected_per_role_while_a_job_runs(fake):
    acc: dict = {}
    token = llm.usage.set(acc)
    try:
        llm.chat("openai:model-a#minimal", [{"role": "user", "content": "a"}], role="customer")
        llm.chat("openai:model-a#minimal", [{"role": "user", "content": "b"}], role="customer")
        llm.chat("openai:model-a#high", [{"role": "user", "content": "c"}], role="agent")
        llm.chat("openai:model-a", [{"role": "user", "content": "d"}])  # no role: not counted
    finally:
        llm.usage.reset(token)
    assert acc["customer"]["calls"] == 2 and acc["customer"]["prompt_tokens"] == 20
    assert acc["customer"]["models"] == {"openai:model-a#minimal": 2}
    assert acc["agent"]["models"] == {"openai:model-a#high": 1} and set(acc) == {"customer", "agent"}


def test_hard_compiler_roles_run_on_the_reasoner_chain(monkeypatch, tmp_path):
    used = {}

    def run_agent(*, chain, role, **kwargs):
        used[role] = chain
        return SimpleNamespace(result={"ok": True})

    monkeypatch.setattr(pipeline, "run_agent", run_agent)
    c = pipeline.Compiler(app=pipeline.AppInput("app", tmp_path), checkpoint={}, workdir=tmp_path, chain="openai:spark", reasoner="openai:wonder",
                          log=lambda *a: None, save=lambda ck: None, heartbeat=lambda: None, add_cost=lambda usd, tokens=0: None)
    submit = SimpleNamespace(name="submit", description="", parameters={}, fn=lambda args: args)
    for role in ("inspector", "builder", "scenario_designer", "validation_investigator", "builder_repair"):
        c.agent(role=role, system="", user="", tools=[], submit=submit)
    assert used == {"inspector": "openai:spark", "builder": "openai:spark", "scenario_designer": "openai:wonder",
                    "validation_investigator": "openai:wonder", "builder_repair": "openai:wonder"}


def test_usage_from_several_jobs_adds_up_per_role():
    a = {"agent": {"calls": 2, "prompt_tokens": 10, "completion_tokens": 4, "cost_usd": 0.001, "latency_ms": 900, "models": {"openai:m#low": 2}}}
    b = {"agent": {"calls": 1, "prompt_tokens": 5, "completion_tokens": 2, "cost_usd": 0.0005, "latency_ms": 300, "models": {"openai:m#low": 1}},
         "customer": {"calls": 1, "prompt_tokens": 3, "completion_tokens": 1, "cost_usd": 0.0001, "latency_ms": 100, "models": {"openai:n#minimal": 1}}}
    merged = llm.merge_usage([a, None, b])
    assert merged["agent"]["calls"] == 3 and merged["agent"]["latency_ms"] == 1200 and merged["agent"]["models"] == {"openai:m#low": 3}
    assert merged["agent"]["cost_usd"] == 0.0015 and set(merged) == {"agent", "customer"}
    assert a["agent"]["calls"] == 2  # the inputs are not changed
