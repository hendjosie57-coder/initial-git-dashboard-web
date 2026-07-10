"""Cyclomatic complexity metrics.

Python files are measured with radon (`radon.complexity.cc_visit`) — the file's
score is the sum of all block complexities. Radon only parses Python, so
JS/TS files use a documented decision-point approximation (McCabe's definition:
1 + number of branch points) that keeps the dashboard populated for mixed repos.
"""

from __future__ import annotations

import logging
import re

from radon.complexity import cc_visit

logger = logging.getLogger(__name__)

# Branch keywords + short-circuit operators for the JS/TS approximation.
_JS_BRANCH_KEYWORDS = re.compile(r"\b(?:if|for|while|case|catch)\b")
_JS_SHORT_CIRCUIT = re.compile(r"&&|\|\|(?!=)|\?\?")

_PY_FALLBACK_KEYWORDS = re.compile(
    r"^\s*(?:if|elif|for|while|except|case)\b|\band\b|\bor\b", re.MULTILINE
)


def python_complexity(source: str) -> int:
    """Sum of radon block complexities; 1 for a trivially flat file."""
    try:
        blocks = cc_visit(source)
    except SyntaxError:
        # Unparseable Python (templates, py2 relics): keyword approximation.
        return 1 + len(_PY_FALLBACK_KEYWORDS.findall(source))
    if not blocks:
        return 1 if source.strip() else 0
    return sum(block.complexity for block in blocks)


def javascript_complexity(source: str) -> int:
    """Regex decision-point approximation for JS/TS-family files."""
    if not source.strip():
        return 0
    branches = len(_JS_BRANCH_KEYWORDS.findall(source))
    short_circuits = len(_JS_SHORT_CIRCUIT.findall(source))
    return 1 + branches + short_circuits


def file_complexity(repo_relative: str, source: str) -> int:
    if repo_relative.endswith(".py"):
        return python_complexity(source)
    return javascript_complexity(source)
