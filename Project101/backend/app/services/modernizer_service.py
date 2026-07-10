"""Mock code modernizer.

Produces `modernizedString` for the workbench split-pane. This is a
placeholder transformation pipeline: a couple of safe, illustrative regex
rewrites plus a banner marking where a real AI modernizer hook plugs in.
Swap `modernize()` for an LLM call when the AI pipeline is wired up.
"""

from __future__ import annotations

import re

_VAR_DECL = re.compile(r"\bvar\s+(?=[A-Za-z_$])")
_LOOSE_EQ = re.compile(r"(?<![=!<>])==(?!=)")
_LOOSE_NEQ = re.compile(r"(?<!=)!=(?!=)")


def _banner(comment_prefix: str) -> str:
    return (
        f"{comment_prefix} [modernizer] Auto-generated preview — "
        f"AI modernizer hook not yet configured; regex pass only.\n"
    )


def modernize(repo_relative: str, source: str) -> str:
    if repo_relative.endswith((".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs")):
        updated = _VAR_DECL.sub("let ", source)
        updated = _LOOSE_EQ.sub("===", updated)
        updated = _LOOSE_NEQ.sub("!==", updated)
        return _banner("//") + updated
    if repo_relative.endswith(".py"):
        return _banner("#") + source
    return source
