import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { useDashboard } from "../store";
import { complexityColor, hexToRgba, nodeRadius, SAGE } from "../lib/colors";
import type { DepEdge, LiveFile } from "../types";

/* ---------------------------------------------------------------------------
   Force-directed module map over the live repository topology.

   Node size  → cyclomatic complexity (computed by radon on the backend)
   Node color → complexity ramp (sage → dusty mustard → terracotta)
   Click      → dispatches activeFileId to the global store, which triggers
                the file-history fetch middleware
--------------------------------------------------------------------------- */

interface GraphNode {
  id: string;
  file: LiveFile;
  x?: number;
  y?: number;
}

export function NodeGraph({
  files,
  edges,
  matchedIds,
}: {
  files: LiveFile[];
  edges: DepEdge[];
  matchedIds: Set<string> | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  const activeFileId = useDashboard((s) => s.activeFileId);
  const selectFile = useDashboard((s) => s.selectFile);
  const refactoredIds = useDashboard((s) => s.refactoredIds);

  // The force engine mutates node/link objects; rebuild only when data changes.
  const graphData = useMemo(
    () => ({
      nodes: files.map((file): GraphNode => ({ id: file.id, file })),
      links: edges.map((e) => ({ source: e.source, target: e.target })),
    }),
    [files, edges],
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
      fgRef.current.zoomToFit(500, 90);
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
      const selected = activeFileId === file.id;
      const r = nodeRadius(file);
      const color = refactored ? SAGE : complexityColor(file.complexity);

      ctx.save();
      ctx.globalAlpha = dimmed ? 0.12 : 1;

      // Flat matte fill with a hairline border for definition on light ground.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = hexToRgba("#2a2a2a", 0.12);
      ctx.lineWidth = 0.75 / globalScale;
      ctx.stroke();

      // Selection / hover ring — quiet charcoal.
      if (selected || hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 2.5 / globalScale + 1.5, 0, 2 * Math.PI);
        ctx.strokeStyle = selected ? "#2a2a2a" : hexToRgba("#2a2a2a", 0.45);
        ctx.lineWidth = 1.2 / globalScale;
        ctx.stroke();
      }

      // Refactored marker: dashed sage ring.
      if (refactored) {
        ctx.beginPath();
        ctx.arc(x, y, r + 3.5, 0, 2 * Math.PI);
        ctx.strokeStyle = hexToRgba(SAGE, 0.55);
        ctx.setLineDash([2.5, 2.5]);
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // With ≤12 nodes we can afford always-on labels.
      if (!dimmed) {
        const fontSize = Math.max(11 / globalScale, 3);
        ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const label = file.name;
        const w = ctx.measureText(label).width;
        const pad = fontSize * 0.3;
        ctx.fillStyle = "rgba(247, 247, 245, 0.85)";
        ctx.fillRect(x - w / 2 - pad, y + r + 3, w + pad * 2, fontSize + pad * 1.6);
        ctx.fillStyle = hovered || selected ? "#2a2a2a" : "#6e6e68";
        ctx.fillText(label, x, y + r + 3 + pad * 0.8);
      }

      ctx.restore();
    },
    [hoverId, activeFileId, refactoredIds, isDimmed],
  );

  const paintPointerArea = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node.file) + 4, 0, 2 * Math.PI);
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
        backgroundColor="#f7f7f5"
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
          return dim ? "rgba(42, 42, 42, 0.04)" : "rgba(42, 42, 42, 0.14)";
        }}
        linkWidth={1}
        linkDirectionalParticles={0}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.35}
        cooldownTicks={120}
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
