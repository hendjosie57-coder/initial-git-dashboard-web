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


# Heading per quick-action; free-form questions and /history share "History lookup".
_HEADINGS = {
    "explain-intent": "Author intent",
    "find-weaknesses": "Risk review",
    "history": "History lookup",
}


def _heading(action: str | None) -> str:
    return _HEADINGS.get(action or "", "History lookup")


def build_mock_reply(
    file_path: str, inquiry: str, context: list[BlameLine], action: str | None = None
) -> str:
    heading = _heading(action)
    if not context:
        return (
            f"### {heading}: `{file_path}`\n\n"
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

    if action == "explain-intent":
        top_author, top_count = authors.most_common(1)[0]
        return (
            f"### {heading}: `{file_path}`\n\n"
            f"> {inquiry}\n\n"
            f"Primary ownership of the relevant region (lines {span}) sits with "
            f"**{top_author}** — {top_count} of {len(context)} lines.\n\n"
            f"**What the commit trail says**\n{commit_md}\n\n"
            f"These commit messages are the clearest signal of why the file is shaped this way."
        )

    if action == "find-weaknesses":
        # Commit that last-touched the most of the relevant lines = concentration hot spot.
        touch = Counter(line.commit_hash for line in context)
        hot_sha, hot_n = touch.most_common(1)[0]
        hot_msg = commits.get(hot_sha) or "(no message)"
        return (
            f"### {heading}: `{file_path}`\n\n"
            f"> {inquiry}\n\n"
            f"I examined **{len(context)} lines** (range {span}) and the commits behind them. "
            f"The heaviest concentration of change traces to `{hot_sha[:10]}` "
            f"('{hot_msg}'), which last touched {hot_n} of these lines — review it first.\n\n"
            f"**Commits to scrutinize**\n{commit_md}\n\n"
            f"**Authors of the relevant lines**\n{author_md}"
        )

    return (
        f"### {heading}: `{file_path}`\n\n"
        f"> {inquiry}\n\n"
        f"I isolated **{len(context)} lines** (range {span}) whose content or commit "
        f"history relates to your question.\n\n"
        f"**Authors of the relevant lines**\n{author_md}\n\n"
        f"**Commits involved**\n{commit_md}"
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


async def answer(
    file_path: str, inquiry: str, context: list[BlameLine], action: str | None = None
) -> str:
    """LLM reply when configured, mock framework otherwise. Logs each step."""
    logger.info("inquiry file=%s question=%r context_lines=%d", file_path, inquiry, len(context))
    reply = await build_llm_reply(file_path, inquiry, context)
    if reply is None:
        reply = build_mock_reply(file_path, inquiry, context, action)
    logger.info("reply file=%s chars=%d", file_path, len(reply))
    return reply
