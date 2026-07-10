import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { REPO } from "../data/mockRepo";
import { useDashboard } from "../store";
import { hexToRgba, nodeColor, nodeRadius } from "../lib/colors";
import type { RepoFile } from "../types";

/* ---------------------------------------------------------------------------
   Full-screen force-directed repository map. Flat matte rendering.

   Node size  → cyclomatic complexity
   Node color → churn/risk heatmap (git diff semantics: green/amber/red)
   Search     → non-matching nodes and their links dim to near-invisible
--------------------------------------------------------------------------- */

interface GraphNode {
  id: string;
  file: RepoFile;
  x?: number;
  y?: number;
}

const REFACTORED_COLOR = "#3fb950";

export function NodeGraph({ matchedIds }: { matchedIds: Set<string> | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  const selectedFileId = useDashboard((s) => s.selectedFileId);
  const selectFile = useDashboard((s) => s.selectFile);
  const refactoredIds = useDashboard((s) => s.refactoredIds);

  // The force engine mutates node/link objects; build them once per mount.
  const graphData = useMemo(
    () => ({
      nodes: REPO.files.map((file): GraphNode => ({ id: file.id, file })),
      links: REPO.edges.map((e) => ({ source: e.source, target: e.target })),
    }),
    [],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit the graph once the initial simulation settles.
  const didFit = useRef(false);
  const handleEngineStop = useCallback(() => {
    if (!didFit.current && fgRef.current) {
      didFit.current = true;
      fgRef.current.zoomToFit(600, 60);
    }
  }, []);

  const isDimmed = useCallback(
    (id: string) => matchedIds !== null && !matchedIds.has(id),
    [matchedIds],
  );

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const { file } = node;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const refactored = refactoredIds.includes(file.id);
      const dimmed = isDimmed(file.id);
      const hovered = hoverId === file.id;
      const selected = selectedFileId === file.id;
      const r = nodeRadius(file);
      const color = refactored ? REFACTORED_COLOR : nodeColor(file);
      const alpha = dimmed ? 0.07 : 1;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Flat fill, no shadows or highlights.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      // Selection / hover ring — neutral gray.
      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 2.5 / globalScale + 1.5, 0, 2 * Math.PI);
        ctx.strokeStyle = selected ? "#d4d4d4" : hexToRgba("#d4d4d4", 0.55);
        ctx.lineWidth = 1.4 / globalScale;
        ctx.stroke();
      }

      // Refactored check ring.
      if (refactored) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = hexToRgba(REFACTORED_COLOR, 0.5);
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Labels appear on zoom-in, hover, or selection.
      if (!dimmed && (hovered || selected || globalScale > 2.2)) {
        const fontSize = Math.max(10 / globalScale, 2.2);
        ctx.font = `500 ${fontSize}px "JetBrains Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = file.name;
        const w = ctx.measureText(label).width;
        const pad = fontSize * 0.35;
        ctx.fillStyle = "rgba(24, 24, 24, 0.85)";
        ctx.fillRect(x - w / 2 - pad, y + r + 2, w + pad * 2, fontSize + pad * 1.4);
        ctx.fillStyle = hovered || selected ? "#d4d4d4" : "#9d9d9d";
        ctx.fillText(label, x, y + r + 2 + pad * 0.7);
      }

      ctx.restore();
    },
    [hoverId, selectedFileId, refactoredIds, isDimmed],
  );

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node.file) + 3, 0, 2 * Math.PI);
      ctx.fill();
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: hoverId ? "pointer" : "grab" }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        backgroundColor="#181818"
        nodeId="id"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeCanvasObject={paintNode as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodePointerAreaPaint={paintPointerArea as any}
        nodeLabel={() => ""}
        linkColor={(link) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const l = link as any;
          const sid = typeof l.source === "object" ? l.source.id : l.source;
          const tid = typeof l.target === "object" ? l.target.id : l.target;
          const dim = isDimmed(sid) || isDimmed(tid);
          return dim ? "rgba(51, 51, 51, 0.15)" : "rgba(69, 69, 69, 0.6)";
        }}
        linkWidth={0.8}
        linkDirectionalParticles={0}
        d3AlphaDecay={0.022}
        d3VelocityDecay={0.32}
        cooldownTicks={140}
        onEngineStop={handleEngineStop}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeHover={(node: any) => setHoverId(node ? node.id : null)}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onNodeClick={(node: any) => selectFile(node.id)}
        onBackgroundClick={() => selectFile(null)}
      />
    </div>
  );
}
