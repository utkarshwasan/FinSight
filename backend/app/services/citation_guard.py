import os
import random
import re
from typing import Optional, Tuple

DEMO_MODE = os.getenv("DEMO_MODE", "0") == "1"


def validate_citations(text: str) -> Tuple[bool, str]:
    """
    Validate that all numeric claims have citation markers.
    Returns (is_valid, message).
    """
    if not text:
        return True, "Empty text"

    # Pattern for numeric claims (percentages, currency, decimals)
    # Looks for numbers that aren't followed by a citation marker
    numeric_pattern = r"\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])"

    # Find all numeric claims
    uncited = re.findall(numeric_pattern, text)

    # Filter out common false positives (dates, section numbers, list markers)
    false_positive_patterns = [
        r"\d{4}",  # years like 2024
        r"^\d+\.$",  # numbered list items at start
    ]

    filtered = []
    for claim in uncited:
        is_fp = False
        for fp_pattern in false_positive_patterns:
            if re.match(fp_pattern, claim.strip()):
                is_fp = True
                break
        if not is_fp and float(claim.strip().replace("$", "").replace("%", "")) < 10000:
            # Skip very large numbers (likely IDs or timestamps)
            filtered.append(claim)

    if filtered:
        return False, f"Uncited numeric claims found: {filtered}"

    return True, "All numerics properly cited"


class CitationGuard:
    """Middleware to block uncited numeric outputs."""

    @staticmethod
    def sanitize(text: str) -> str:
        """Replace uncited numbers with redaction notice."""
        is_valid, _ = validate_citations(text)
        if is_valid:
            return text

        # Replace uncited numeric claims
        numeric_pattern = r"\$?\d+(?:\.\d+)?%?(?!\s*\[\d+\])"

        def replace_uncited(match):
            num = match.group(0)
            return f"[REDACTED: uncited numeric]"

        sanitized = re.sub(numeric_pattern, replace_uncited, text)
        return (
            sanitized
            + "\n\n⚠️ Note: Some numeric claims were removed for citation compliance."
        )
