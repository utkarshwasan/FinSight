# backend/tests/test_services.py

import pytest
from app.services.citation_guard import CitationGuard


def test_citation_guard_validate():
    # Years allowed
    ok, _ = CitationGuard.validate("In 2024 AAPL rose [1]")
    assert ok is True

    # Uncited number caught
    ok, vio = CitationGuard.validate("AAPL rose 5.2% today")
    assert not ok and len(vio) == 1

    # List markers allowed
    ok, _ = CitationGuard.validate("1. First item")
    assert ok is True


def test_citation_guard_sanitize():
    out = CitationGuard.sanitize("AAPL rose 5.2% today")
    assert "[REDACTED: uncited numeric]" in out
    assert "some numeric claims were redacted" in out
