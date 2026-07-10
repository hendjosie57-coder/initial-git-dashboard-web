"""Contextual blame chat.

Pipeline: run `git blame` → score each line's relevance against the user's
inquiry → answer with either the Anthropic Messages API (when configured) or a
deterministic mock summariser. The mock keeps the endpoint fully functional
offline; the LLM path activates when `ANTHROPIC_API_KEY` is set and the
`anthropic` package is installed.
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter

from app import config
from app.services.git_service import BlameLine

logger = logging.getLogger("chat.contextual_blame")

_MAX_CONTEXT_LINES = 40
_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]{2,}")
_STOPWORDS = frozenset(
    "the and for with this that what when where who why how did does was were are you can"
    " could would should about into from have has had all any not".split()
)


def _keywords(text: str) -> set[str]:
    return {w.lower() for w in _WORD.findall(text)} - _STOPWORDS


def select_relevant_lines(blame: list[BlameLine], inquiry: str) -> list[BlameLine]:
    """Lines most related to the inquiry (keyword overlap over content,
    commit message, and author), capped at _MAX_CONTEXT_LINES, in file order."""
    wanted = _keywords(inquiry)
    scored: list[tuple[int, BlameLine]] = []
    for line in blame:
        haystack = _keywords(f"{line.content} {line.commit_message} {line.author_name}")
        score = len(wanted & haystack)
        if score:
            scored.append((score, line))

    if scored:
        scored.sort(key=lambda pair: (-pair[0], pair[1].line_index))
        picked = [line for _, line in scored[:_MAX_CONTEXT_LINES]]
    else:
        # No lexical overlap — fall back to the head of the file for context.
        picked = blame[:_MAX_CONTEXT_LINES]
    return sorted(picked, key=lambda line: line.line_index)


# --- Mock response framework ---------------------------------------------------


def build_mock_reply(file_path: str, inquiry: str, context: list[BlameLine]) -> str:
    if not context:
        return (
            f"### History lookup: `{file_path}`\n\n"
            "No blame data is available for this file (it may be new or untracked)."
        )

    authors = Counter(line.author_name for line in context)
    commits: dict[str, str] = {}
    for line in context:
        commits.setdefault(line.commit_hash, line.commit_message)

    author_md = "\n".join(f"- **{name}** — {count} line(s)" for name, count in authors.most_common())
    commit_md = "\n".join(
        f"- `{sha[:10]}` — {msg or '(no message)'}" for sha, msg in list(commits.items())[:5]
    )
    span = f"{context[0].line_index}–{context[-1].line_index}"

    return (
        f"### History lookup: `{file_path}`\n\n"
        f"> {inquiry}\n\n"
        f"I isolated **{len(context)} lines** (range {span}) whose content or commit "
        f"history relates to your question.\n\n"
        f"**Authors of the relevant lines**\n{author_md}\n\n"
        f"**Commits involved**\n{commit_md}\n\n"
        f"_This is the built-in mock analyst. Set `ANTHROPIC_API_KEY` (and install the "
        f"`anthropic` package) to enable full LLM-generated answers._"
    )


# --- Optional Anthropic integration ---------------------------------------------

_SYSTEM_PROMPT = (
    "You are a senior engineer answering questions about a file's git history. "
    "You receive a JSON array of git-blame records (lineIndex, authorName, commitHash, "
    "commitMessage, sourceLineContent) already filtered for relevance. Answer the user's "
    "question grounded strictly in those records: name authors, quote line numbers and "
    "short code fragments, and reference commit hashes (short form). Reply in concise "
    "markdown. If the records cannot answer the question, say so plainly."
)


async def build_llm_reply(file_path: str, inquiry: str, context: list[BlameLine]) -> str | None:
    """Real LLM answer via the Anthropic Messages API; None if unavailable."""
    if not config.ANTHROPIC_API_KEY:
        return None
    try:
        from anthropic import AsyncAnthropic
    except ImportError:
        logger.warning("ANTHROPIC_API_KEY set but the `anthropic` package is not installed")
        return None

    blame_json = json.dumps(
        [
            {
                "lineIndex": line.line_index,
                "authorName": line.author_name,
                "commitHash": line.commit_hash,
                "commitMessage": line.commit_message,
                "sourceLineContent": line.content,
            }
            for line in context
        ],
        ensure_ascii=False,
    )
    try:
        client = AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model=config.ANTHROPIC_MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"File: {file_path}\n\n"
                        f"Blame records:\n{blame_json}\n\n"
                        f"Question: {inquiry}"
                    ),
                }
            ],
        )
    except Exception:
        logger.exception("Anthropic request failed; falling back to mock reply")
        return None

    text = "".join(block.text for block in response.content if block.type == "text")
    return text or None


async def answer(file_path: str, inquiry: str, context: list[BlameLine]) -> str:
    """LLM reply when configured, mock framework otherwise. Logs each step."""
    logger.info("inquiry file=%s question=%r context_lines=%d", file_path, inquiry, len(context))
    reply = await build_llm_reply(file_path, inquiry, context)
    if reply is None:
        reply = build_mock_reply(file_path, inquiry, context)
    logger.info("reply file=%s chars=%d", file_path, len(reply))
    return reply
