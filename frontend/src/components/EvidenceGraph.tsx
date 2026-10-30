import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import {
  Pause,
  Play,
  SkipBack,
  SkipForward,
  RotateCcw,
  Download,
} from "lucide-react";
import type { Study } from "../types";
import { Badge, download, time } from "./ui";
import { usePreferences } from "../services";
export default function EvidenceGraph({ study }: { study: Study }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const reduced = usePreferences((s) => s.reduced);
  useEffect(() => {
    setCursor(0);
    setSelected("");
    setPlaying(false);
  }, [study.id]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setCursor((c) => {
          if (c >= study.events.length - 1) {
            setPlaying(false);
            return c;
          }
          return c + 1;
        }),
      1400 / speed,
    );
    return () => clearInterval(t);
  }, [playing, speed, study.events.length]);
  const nodes = useMemo(
    () =>
      study.events
        .filter((e) => filter === "all" || e.source === filter)
        .map((e) => {
          const i = study.events.indexOf(e);
          return {
            id: e.id,
            position: { x: (i % 4) * 205, y: Math.floor(i / 4) * 160 + 25 },
            data: {
              label: (
                <div className="evidence-node">
                  <small>{e.source} / OBSERVED</small>
                  <strong>{e.type}</strong>
                  <span>
                    {time(e.time)} IST · {e.id}
                  </span>
                </div>
              ),
            },
            style: {
              width: 185,
              borderColor: i === cursor ? "#167d78" : "#dce5e0",
              boxShadow:
                i === cursor ? "0 0 0 4px #167d7818" : "0 6px 15px #14263808",
            },
          };
        }),
    [study, filter, cursor],
  );
  const edges = nodes
    .slice(1)
    .map((n, i) => ({
      id: `edge-${n.id}`,
      source: nodes[i].id,
      target: n.id,
      label: "precedes",
      animated: playing && !reduced,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#79a99e" },
    }));
  const ev = study.events.find((e) => e.id === selected);
  function exportGraph() {
    const body = study.events
      .map(
        (e, i) =>
          `<g transform="translate(${30 + (i % 4) * 220},${35 + Math.floor(i / 4) * 130})"><rect width="200" height="95" rx="10" fill="#f0f4f1" stroke="#167d78"/><text x="12" y="27" font-family="sans-serif" font-size="13">${e.type.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</text><text x="12" y="53" font-size="12">${e.source}</text><text x="12" y="75" font-size="11">${e.id}</text></g>`,
      )
      .join("");
    const url = URL.createObjectURL(
      new Blob(
        [
          `<svg xmlns="http://www.w3.org/2000/svg" width="920" height="320">${body}</svg>`,
        ],
        { type: "image/svg+xml" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${study.id}-graph.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="graph-workspace">
      <div className="toolbar">
        <Badge tone="green">Observed evidence</Badge>
        <select
          aria-label="Filter evidence source"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All source systems</option>
          {[...new Set(study.events.map((e) => e.source))].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          className="icon-button"
          title="Export graph image"
          onClick={exportGraph}
        >
          <Download size={16} />
        </button>
        <button
          className="button small"
          onClick={() => download(`${study.id}-evidence.json`, study.events)}
        >
          Raw evidence
        </button>
      </div>
      <div className="graph-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.3}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => setSelected(n.id)}
          onEdgeClick={(_, e) => setSelected(e.target)}
          deleteKeyCode={null}
        >
          <Background gap={22} color="#d8e3dd" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="mobile-evidence">
        {study.events.map((e) => (
          <button
            key={e.id}
            onClick={() => setSelected(e.id)}
            className="mobile-event"
          >
            <small>{time(e.time)} IST</small>
            <strong>{e.type}</strong>
            <span>{e.source} → next observed event</span>
          </button>
        ))}
      </div>
      <div className="timeline-controls">
        <button
          aria-label="Previous event"
          className="icon-button"
          onClick={() => setCursor(Math.max(0, cursor - 1))}
        >
          <SkipBack size={16} />
        </button>
        <button
          aria-label={playing ? "Pause timeline" : "Play timeline"}
          className="icon-button teal"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button
          aria-label="Next event"
          className="icon-button"
          onClick={() =>
            setCursor(Math.min(study.events.length - 1, cursor + 1))
          }
        >
          <SkipForward size={16} />
        </button>
        <input
          aria-label="Evidence timeline"
          type="range"
          min="0"
          max={study.events.length - 1}
          value={cursor}
          onChange={(e) => setCursor(+e.target.value)}
        />
        <span className="mono">
          {time(study.events[cursor]?.time ?? study.time)}
        </span>
        <select
          aria-label="Playback speed"
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        >
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={0.5}>0.5×</option>
        </select>
        <button
          aria-label="Reset timeline"
          className="icon-button"
          onClick={() => {
            setCursor(0);
            setPlaying(false);
            setFilter("all");
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      {selected && (
        <div className="evidence-inspector">
          <button className="text-button" onClick={() => setSelected("")}>
            Close evidence
          </button>
          <h3>{ev?.type}</h3>
          <p>{ev?.detail}</p>
          <small>
            Provenance: {ev?.source} · {ev?.id} · {ev?.time}
          </small>
        </div>
      )}
    </div>
  );
}
