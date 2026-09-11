import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphLink, GraphNode } from "./graph-model";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelect: (id: string) => void;
};

const VB_W = 920;
const VB_H = 700;

function linkStyle(a: GraphNode | undefined, b: GraphNode | undefined) {
  const depth = Math.max(a?.tier ?? 3, b?.tier ?? 3);
  if (depth <= 1) return { stroke: "#d1d5db", strokeWidth: 1.5 };
  if (depth === 2) return { stroke: "#e5e7eb", strokeWidth: 1 };
  return { stroke: "#e5e7eb", strokeWidth: 0.75 };
}

function nodeVisual(tier: GraphNode["tier"]) {
  switch (tier) {
    case 0:
      return { r: 0, labelY: 0, fontSize: 0 };
    case 1:
      return { r: 16, labelY: 27, fontSize: 11 };
    case 2:
      return { r: 11, labelY: 21, fontSize: 9 };
    default:
      return { r: 8, labelY: 17, fontSize: 9 };
  }
}

export function SkillGraph({ nodes, links, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const [ready, setReady] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [grabbing, setGrabbing] = useState(false);
  const panSession = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const dragSession = useRef<{
    id: string;
    startSvg: { x: number; y: number };
    startOff: { x: number; y: number };
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reset offsets when the node set changes identity.
  const nodeKey = useMemo(() => nodes.map((n) => n.id).join(","), [nodes]);
  useEffect(() => {
    setOffsets({});
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, [nodeKey]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const placed = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        x: n.x + (offsets[n.id]?.x ?? 0),
        y: n.y + (offsets[n.id]?.y ?? 0),
      })),
    [nodes, offsets],
  );
  const placedById = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);

  function toSvgCoords(clientX: number, clientY: number) {
    const svg = svgRef.current!;
    const pt = new DOMPoint(clientX, clientY);
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    // Convert viewBox units (getScreenCTM already accounts for viewBox).
    return { x: p.x, y: p.y };
  }

  function unitsPerPx() {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return VB_W / rect.width;
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (dragSession.current) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    panSession.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y, moved: false };
  }

  function onSvgPointerMove(e: React.PointerEvent) {
    const panS = panSession.current;
    const dragS = dragSession.current;
    if (dragS) {
      const cur = toSvgCoords(e.clientX, e.clientY);
      const dx = cur.x - dragS.startSvg.x;
      const dy = cur.y - dragS.startSvg.y;
      if (!dragS.moved && Math.hypot(dx, dy) > 3) {
        dragS.moved = true;
        setGrabbing(true);
      }
      if (dragS.moved) {
        setOffsets((prev) => ({
          ...prev,
          [dragS.id]: { x: dragS.startOff.x + dx / zoom, y: dragS.startOff.y + dy / zoom },
        }));
      }
      return;
    }
    if (!panS) return;
    const upp = unitsPerPx();
    const dx = (e.clientX - panS.sx) * upp;
    const dy = (e.clientY - panS.sy) * upp;
    if (!panS.moved && Math.hypot(e.clientX - panS.sx, e.clientY - panS.sy) > 4) {
      panS.moved = true;
      setGrabbing(true);
    }
    if (panS.moved) setPan({ x: panS.px + dx, y: panS.py + dy });
  }

  function endPan(e: React.PointerEvent) {
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    panSession.current = null;
    if (!dragSession.current) setGrabbing(false);
  }

  function onWheel(e: React.WheelEvent) {
    const next = Math.min(2.5, Math.max(0.4, zoom * Math.exp(-e.deltaY * 0.001)));
    if (next === zoom) return;
    const s = toSvgCoords(e.clientX, e.clientY);
    const ratio = next / zoom;
    setPan({ x: s.x - (s.x - pan.x) * ratio, y: s.y - (s.y - pan.y) * ratio });
    setZoom(next);
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragSession.current = {
      id,
      startSvg: toSvgCoords(e.clientX, e.clientY),
      startOff: offsets[id] ?? { x: 0, y: 0 },
      moved: false,
    };
  }

  function onNodePointerMove(e: React.PointerEvent) {
    if (dragSession.current) onSvgPointerMove(e);
  }

  function onNodePointerUp(e: React.PointerEvent, id: string, tier: GraphNode["tier"]) {
    e.stopPropagation();
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    const wasDrag = dragSession.current?.moved;
    dragSession.current = null;
    setGrabbing(false);
    if (!wasDrag && tier !== 0) onSelect(id);
  }

  if (nodes.length === 0) return <p className="skills-empty">No skills to graph yet.</p>;

  return (
    <div className="relative w-full h-full skills-graph-wrap">
      <svg
        ref={svgRef}
        className={`w-full h-full skills-graph-svg${grabbing ? " is-grabbing" : ""}`}
        data-skill-graph={ready ? "ready" : "loading"}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        role="img"
        aria-label="Skill graph"
        style={{ touchAction: "none", opacity: ready ? 1 : 0 }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={onWheel}
      >
        <g ref={worldRef} transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          <g className="links">
            {links.map((link) => {
              const from = placedById.get(link.from);
              const to = placedById.get(link.to);
              if (!from || !to) return null;
              const style = linkStyle(byId.get(link.from), byId.get(link.to));
              return (
                <line
                  key={`${link.from}-${link.to}-${link.kind}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  style={{ opacity: 1 }}
                />
              );
            })}
          </g>
          <g className="nodes">
            {placed.map((node) => {
              const v = nodeVisual(node.tier);
              const isHub = node.tier === 0;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={isHub ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
                  onPointerDown={(e) => {
                    if (!isHub) onNodePointerDown(e, node.id);
                  }}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={(e) => onNodePointerUp(e, node.id, node.tier)}
                  onPointerCancel={() => {
                    dragSession.current = null;
                    setGrabbing(false);
                  }}
                >
                  <g
                    style={{
                      transform: "none",
                      opacity: 1,
                      transformOrigin: "50% 50%",
                      transformBox: "fill-box",
                    }}
                  >
                    {isHub ? (
                      <rect
                        x="-12"
                        y="-12"
                        width="24"
                        height="24"
                        fill="#f97316"
                        stroke="#f97316"
                        strokeWidth="0"
                      >
                        <title>{node.label}</title>
                      </rect>
                    ) : (
                      <>
                        <circle
                          r={v.r}
                          className={
                            node.tier === 1
                              ? "skill-tier-1 dark:fill-black dark:stroke-gray-600"
                              : node.tier === 2
                                ? "skill-tier-2 dark:fill-black dark:stroke-gray-600"
                                : "skill-tier-3 dark:fill-black dark:stroke-gray-600"
                          }
                          fill={node.tier === 3 ? "#f3f4f6" : "#ffffff"}
                          stroke={node.tier === 1 ? "#9ca3af" : node.tier === 2 ? "#c4b5fd" : "#d1d5db"}
                          strokeWidth={node.tier === 1 ? 2 : node.tier === 2 ? 1.5 : 1}
                          style={{ filter: "none" }}
                        />
                        <text
                          y={v.labelY}
                          textAnchor="middle"
                          className="fill-gray-600 dark:fill-gray-300 font-sans pointer-events-none select-none"
                          style={{ fontSize: `${v.fontSize}px` }}
                        >
                          {node.label}
                        </text>
                      </>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
