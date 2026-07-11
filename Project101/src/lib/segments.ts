import type { ChatSegment } from "../types";

/* ---------------------------------------------------------------------------
   Chat segment utilities.

   The backend replies with markdown; the ChatPane streams typed segments.
   markdownToSegments() bridges the two: fenced code → block segments, inline
   backticks → inline chips, `L<n>` references → clickable line chips,
   everything else → text. Streaming length/slice helpers live here too so the
   live chat path has no dependency on the mock data engine.
--------------------------------------------------------------------------- */

const FENCE_RX = /```(\w*)\n([\s\S]*?)```/g;
const INLINE_RX = /`([^`\n]+)`/g;
const LINEREF_RX = /^L(\d+)$/;

function inlineSegments(text: string, out: ChatSegment[]): void {
  let last = 0;
  for (const m of text.matchAll(INLINE_RX)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: text.slice(last, idx) });
    const lineRef = LINEREF_RX.exec(m[1]);
    if (lineRef) {
      out.push({ kind: "lineref", line: Number(lineRef[1]), label: m[1] });
    } else {
      out.push({ kind: "inline", text: m[1] });
    }
    last = idx + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
}

export function markdownToSegments(markdown: string): ChatSegment[] {
  const out: ChatSegment[] = [];
  let last = 0;
  for (const m of markdown.matchAll(FENCE_RX)) {
    const idx = m.index ?? 0;
    if (idx > last) inlineSegments(markdown.slice(last, idx), out);
    out.push({ kind: "block", code: m[2].replace(/\n$/, ""), lang: m[1] || "text" });
    last = idx + m[0].length;
  }
  if (last < markdown.length) inlineSegments(markdown.slice(last), out);
  return out;
}

/** Total character count of a segment list, for the streaming reveal. */
export function segmentsLength(segments: ChatSegment[]): number {
  return segments.reduce((sum, s) => {
    if (s.kind === "text" || s.kind === "inline") return sum + s.text.length;
    if (s.kind === "lineref") return sum + s.label.length;
    return sum + s.code.length;
  }, 0);
}

/** Slice a segment list to the first `chars` characters, for streaming. */
export function sliceSegments(segments: ChatSegment[], chars: number): ChatSegment[] {
  const out: ChatSegment[] = [];
  let used = 0;
  for (const s of segments) {
    const len =
      s.kind === "text" || s.kind === "inline"
        ? s.text.length
        : s.kind === "lineref"
          ? s.label.length
          : s.code.length;
    if (used + len <= chars) {
      out.push(s);
      used += len;
      continue;
    }
    const remain = chars - used;
    if (remain <= 0) break;
    if (s.kind === "text") out.push({ kind: "text", text: s.text.slice(0, remain) });
    else if (s.kind === "block") out.push({ ...s, code: s.code.slice(0, remain) });
    // inline/lineref chips appear atomically once fully streamed
    break;
  }
  return out;
}
