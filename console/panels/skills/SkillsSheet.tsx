import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { ConsoleNav } from "../../shell/nav";
import { Sheet } from "../../shell/Sheet";
import { buildSkillGraph } from "./graph-model";

type SkillEdge = { to: string; kind: "routes-to" | "compose-with" };

type SkillRecord = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  instructions: string;
  tools: string[];
  maxSteps?: number;
  edges: SkillEdge[];
  updatedAt: number;
};

type SkillMeta = Omit<SkillRecord, "instructions" | "updatedAt">;

type Props = {
  nav: Extract<ConsoleNav, { panel: "skills" }>;
  onClose: () => void;
  onSelect: (id: string | null) => void;
};

function previewHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n\n/g, "<br/><br/>");
}

export function SkillsSheet({ nav, onClose, onSelect }: Props) {
  const [metas, setMetas] = useState<SkillMeta[]>([]);
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [draft, setDraft] = useState<SkillRecord | null>(null);
  const [mode, setMode] = useState<"edit" | "graph">("edit");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const refreshList = useCallback(async () => {
    const res = await api<{ skills: SkillMeta[]; toolNames?: string[] }>("/v1/skills");
    setMetas(res.skills);
    if (res.toolNames) setToolNames(res.toolNames);
  }, []);

  useEffect(() => {
    void refreshList().catch((err) => setStatus(String(err)));
  }, [refreshList]);

  useEffect(() => {
    if (!nav.selectedId) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    void api<{ skill: SkillRecord }>(`/v1/skills/${nav.selectedId}`)
      .then((res) => {
        if (!cancelled) setDraft(res.skill);
      })
      .catch((err) => setStatus(String(err)));
    return () => {
      cancelled = true;
    };
  }, [nav.selectedId]);

  const graph = useMemo(() => buildSkillGraph(metas), [metas]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setStatus(null);
    try {
      if (creating) {
        const res = await api<{ skill: SkillRecord }>("/v1/skills", {
          method: "POST",
          body: JSON.stringify({
            id: draft.id,
            name: draft.name,
            description: draft.description,
            tags: draft.tags,
            instructions: draft.instructions,
            tools: draft.tools,
            maxSteps: draft.maxSteps,
            edges: draft.edges,
          }),
        });
        setCreating(false);
        setDraft(res.skill);
        onSelect(res.skill.id);
      } else {
        const res = await api<{ skill: SkillRecord }>(`/v1/skills/${draft.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            tags: draft.tags,
            instructions: draft.instructions,
            tools: draft.tools,
            maxSteps: draft.maxSteps,
            edges: draft.edges,
          }),
        });
        setDraft(res.skill);
      }
      await refreshList();
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function exportSkills() {
    setBusy(true);
    try {
      const res = await api<{ paths: string[] }>("/v1/skills/export", { method: "POST" });
      setStatus(`Exported ${res.paths.length} files`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function startCreate() {
    setCreating(true);
    setMode("edit");
    const id = `skill-${Date.now().toString(36)}`;
    onSelect(id);
    setDraft({
      id,
      name: "New skill",
      description: "Describe when the planner should pick this skill.",
      tags: [],
      instructions: "# New skill\n\nWrite instructions here.\n",
      tools: ["ask_user"],
      maxSteps: 8,
      edges: [],
      updatedAt: Date.now(),
    });
  }

  function toggleTool(name: string) {
    if (!draft) return;
    const has = draft.tools.includes(name);
    setDraft({
      ...draft,
      tools: has ? draft.tools.filter((t) => t !== name) : [...draft.tools, name],
    });
  }

  function addEdge(to: string) {
    if (!draft || !to || to === draft.id) return;
    if (draft.edges.some((e) => e.to === to)) return;
    setDraft({
      ...draft,
      edges: [...draft.edges, { to, kind: "compose-with" }],
    });
  }

  return (
    <Sheet
      title="Skills"
      eyebrow="registry"
      onClose={onClose}
      className="skills-panel"
      actions={
        <>
          <button type="button" className="sheet-action" onClick={() => setMode(mode === "edit" ? "graph" : "edit")}>
            {mode === "edit" ? "Graph" : "Editor"}
          </button>
          <button type="button" className="sheet-action" onClick={startCreate}>
            New
          </button>
          <button type="button" className="sheet-action" onClick={() => void exportSkills()} disabled={busy}>
            Export
          </button>
        </>
      }
    >
      <div className="skills-layout">
        <aside className="skills-list">
          {metas.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className={`skills-list-item${nav.selectedId === skill.id ? " is-active" : ""}`}
              onClick={() => {
                setCreating(false);
                onSelect(skill.id);
              }}
            >
              <strong>{skill.name}</strong>
              <span>{skill.id}</span>
            </button>
          ))}
        </aside>

        <div className="skills-main">
          {mode === "graph" ? (
            <svg className="skills-graph" viewBox="0 0 320 280" role="img" aria-label="Skill graph">
              {graph.links.map((link) => {
                const from = graph.nodes.find((n) => n.id === link.from);
                const to = graph.nodes.find((n) => n.id === link.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={`${link.from}-${link.to}-${link.kind}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className="skills-graph-edge"
                  />
                );
              })}
              {graph.nodes.map((node) => (
                <g key={node.id} className="skills-graph-node" onClick={() => onSelect(node.id)}>
                  <circle cx={node.x} cy={node.y} r="18" />
                  <text x={node.x} y={node.y + 32} textAnchor="middle">
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          ) : draft ? (
            <div className="form skills-editor">
              <label>
                Name
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Description
                <input
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>
              <label>
                Tags (comma separated)
                <input
                  value={draft.tags.join(", ")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                Max steps
                <input
                  type="number"
                  value={draft.maxSteps ?? 8}
                  onChange={(e) =>
                    setDraft({ ...draft, maxSteps: Number(e.target.value) || undefined })
                  }
                />
              </label>
              <label>
                Instructions (markdown)
                <textarea
                  className="skills-md"
                  value={draft.instructions}
                  onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                />
              </label>
              <div className="skills-preview" dangerouslySetInnerHTML={{ __html: previewHtml(draft.instructions) }} />
              <fieldset className="skills-tools">
                <legend>Tools</legend>
                <div className="skills-tool-grid">
                  {toolNames.map((name) => (
                    <label key={name} className="skills-tool">
                      <input
                        type="checkbox"
                        checked={draft.tools.includes(name)}
                        onChange={() => toggleTool(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Add compose-with edge
                <select
                  defaultValue=""
                  onChange={(e) => {
                    addEdge(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Select skill…</option>
                  {metas
                    .filter((m) => m.id !== draft.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              <ul className="skills-edges">
                {draft.edges.map((edge) => (
                  <li key={`${edge.to}-${edge.kind}`}>
                    {edge.kind} → {edge.to}{" "}
                    <button
                      type="button"
                      className="sheet-action"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          edges: draft.edges.filter((e) => !(e.to === edge.to && e.kind === edge.kind)),
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="form-actions">
                <button type="button" className="sheet-action" disabled={busy} onClick={() => void save()}>
                  {busy ? "Saving…" : "Save"}
                </button>
                {status ? <span className="skills-status">{status}</span> : null}
              </div>
            </div>
          ) : (
            <p className="skills-empty">Select a skill or create a new one.</p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
