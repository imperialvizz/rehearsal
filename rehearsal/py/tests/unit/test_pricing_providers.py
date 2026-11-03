"""Prices for the vendor and host providers, derived from OpenRouter's listings (no network)."""

from pathlib import Path

import pytest

from rehearsal import pricing
from rehearsal.agents import llm
from rehearsal.agents.llm import PROVIDERS
from rehearsal.config import settings
from rehearsal.pricing import Quote

ROOT = Path(__file__).resolve().parents[4]  # the repository; the Python package is rehearsal/py

LISTING = {
    "anthropic/claude-haiku-4.5": Quote("openrouter", "anthropic/claude-haiku-4.5", 1.0, 5.0, "openrouter price list"),
    "openai/gpt-oss-120b": Quote("openrouter", "openai/gpt-oss-120b", 0.1, 0.5, "openrouter price list"),
}
ROWS = {"openai/gpt-oss-120b": [{"host": "Groq", "input_per_m": 0.15, "output_per_m": 0.6}, {"host": "Cerebras", "input_per_m": 0.35, "output_per_m": 0.75}]}


def test_vendor_price_matches_dated_snapshot():
    q = pricing._derived("anthropic", "claude-haiku-4-5-20251001", LISTING, ROWS.get)
    assert (q.provider, q.input_per_m, q.output_per_m) == ("anthropic", 1.0, 5.0)


def test_vendor_price_never_borrows_another_vendors_model():
    assert pricing._derived("openai", "claude-haiku-4-5", LISTING, ROWS.get) is None


def test_host_price_is_that_hosts_row():
    q = pricing._derived("cerebras", "openai/gpt-oss-120b", LISTING, ROWS.get)
    assert (q.input_per_m, q.output_per_m) == (0.35, 0.75)
    assert pricing._derived("together", "openai/gpt-oss-120b", LISTING, ROWS.get) is None


def test_every_provider_has_a_price_source():
    assert all(pricing.price_source(name) for name in PROVIDERS)
    assert set(pricing.VENDORS) | set(pricing.HOSTS) <= set(PROVIDERS)


def test_the_library_names_no_model_and_unset_roles_use_the_compilers_chain(monkeypatch):
    monkeypatch.setenv("REHEARSAL_ENV_FILE", "/dev/null")
    for role in ("COMPILER", "AGENT", "PARTICIPANT", "IMPROVER", "REASONER"):
        monkeypatch.setenv(f"REHEARSAL_MODEL_{role}", "")
    try:
        settings.cache_clear()
        s = settings()
        assert not any((s.model_compiler, s.model_reasoner, s.model_agent, s.model_participant, s.model_improver))
        monkeypatch.setenv("REHEARSAL_MODEL_COMPILER", "openai:model-a#medium")
        monkeypatch.setenv("REHEARSAL_MODEL_REASONER", "openai:model-b#high")
        settings.cache_clear()
        s = settings()
        assert s.model_agent == s.model_participant == "openai:model-a#medium" and s.model_improver == "openai:model-b#high"
    finally:
        settings.cache_clear()
    with pytest.raises(llm.LLMError, match="no model is set"):
        llm.chat("", [{"role": "user", "content": "hi"}])


def test_a_price_from_pricing_yaml_is_what_a_call_is_billed_at(tmp_path, monkeypatch):
    prices = tmp_path / "pricing.yaml"
    prices.write_text('"local:model-a": {input_per_m: 1.25, output_per_m: 4.25, source: house price list, as_of: 2026-11-03}\n')
    monkeypatch.setenv("REHEARSAL_PRICING_FILE", str(prices))
    pricing._cache.clear()
    try:
        q = pricing.billing_quote("local", "model-a")
        assert (q.input_per_m, q.output_per_m, q.source) == (1.25, 4.25, "house price list")
        assert pricing.billing_quote("local", "model-z") is None  # unknown is reported as unknown, never invented
    finally:
        pricing._cache.clear()


def test_every_model_the_example_settings_choose_has_a_price(monkeypatch):
    """The repository's .env.example chooses the models and its pricing.yaml prices them; the two must agree."""
    example = {k: v for k, _, v in (line.partition("=") for line in (ROOT / ".env.example").read_text().splitlines()) if k.startswith("REHEARSAL_")}
    for name, value in example.items():  # the providers it declares, too
        monkeypatch.setenv(name, value)
    env = {k: v for k, v in example.items() if k.startswith("REHEARSAL_MODEL_") and v}
    assert env, ".env.example chooses no model"
    monkeypatch.setenv("REHEARSAL_PRICING_FILE", str(ROOT / "pricing.yaml"))
    pricing._cache.clear()
    try:
        for chain in env.values():
            for provider, model, _ in llm.parse_chain(chain):
                assert pricing.billing_quote(provider, model), f"{provider}:{model} has no price in pricing.yaml"
    finally:
        pricing._cache.clear()
