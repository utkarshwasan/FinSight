"""Backend CitationGuard: blocks rendering of uncited numeric claims.

Mandatory per CLAUDE.md. Applied to every LLM output written to AgentState,
not just the final answer.
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from typing import Iterable

# Compile once. Bug-prone if recompiled inline — keep as module constant.
_NUMERIC_PATTERN = re.compile(r"(?<!\[)\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])")
_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")
_LIST_MARKER = re.compile(r"^\s*\d+\.\s", re.MULTILINE)


@dataclass(frozen=True)
class Violation:
    text: str
    span: tuple[int, int]


class CitationGuard:
    @staticmethod
    def find_uncited(text: str) -> list[Violation]:
        if not text:
            return []
        years = {m.span() for m in _YEAR_PATTERN.finditer(text)}
        list_markers = {m.span() for m in _LIST_MARKER.finditer(text)}
        out: list[Violation] = []
        # NEW: Skip JSON-like strings entirely to avoid breaking technical payloads (e.g. {"risk_score": 0.5})
        if text.strip().startswith("{") and text.strip().endswith("}"):
            return []

        for m in _NUMERIC_PATTERN.finditer(text):
            span = m.span()
            # Skip years (e.g., 2024)
            if any(s[0] <= span[0] < s[1] for s in years):
                continue
            # Skip list markers (e.g., "1. ", "2. ")
            if any(s[0] <= span[0] < s[1] for s in list_markers):
                continue
            # Skip ID-like numbers > 10000
            try:
                value = float(m.group().lstrip("$").rstrip("%"))
                if value > 10000:
                    continue
            except ValueError:
                pass
            out.append(Violation(text=m.group(), span=span))
        return out

    @staticmethod
    def validate(text: str) -> tuple[bool, list[Violation]]:
        v = CitationGuard.find_uncited(text)
        return len(v) == 0, v

    @staticmethod
    def sanitize(text: str) -> str:
        if not text:
            return ""
        violations = CitationGuard.find_uncited(text)
        if not violations:
            return text
        # Replace from end → start to keep spans valid
        out = text
        for v in sorted(violations, key=lambda x: -x.span[0]):
            out = out[: v.span[0]] + "[REDACTED: uncited numeric]" + out[v.span[1] :]
        out += "\n\n_Note: some numeric claims were redacted because they lacked citation chips._"
        return out
