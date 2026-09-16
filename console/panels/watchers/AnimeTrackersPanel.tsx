import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseAnimeTracker, type AnimeTrackerView } from "../../api/parse";
import { formatRelativeTime } from "../../lib/relative-time";
import {
  defaultReleaseLocal,
  fromDatetimeLocal,
  toDatetimeLocal,
} from "./anime-time";
import { useAnimeTrackers } from "./useAnimeTrackers";

type Props = {
  selectedId: string | null;
  draft: boolean;
  onSelect: (id: string | null) => void;
  onDraft: () => void;
};

type FormState = {
  title: string;
  imageUrl: string;
  releaseLocal: string;
  kind: "anime" | "manhwa";
  episode: string;
};

function blankForm(): FormState {
  return {
    title: "",
    imageUrl: "",
    releaseLocal: defaultReleaseLocal(),
    kind: "anime",
    episode: "1",
  };
}

function formFromTracker(tracker: AnimeTrackerView): FormState {
  return {
    title: tracker.title,
    imageUrl: tracker.imageUrl,
    releaseLocal: toDatetimeLocal(tracker.nextReleaseAt),
    kind: tracker.kind,
    episode: String(tracker.episode),
  };
}

function unitLabel(kind: "anime" | "manhwa") {
  return kind === "manhwa" ? "Chapter" : "Episode";
}

function coverOk(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function AnimeTrackersPanel({ selectedId, draft, onSelect, onDraft }: Props) {
  const state = useAnimeTrackers(true);
  const [form, setForm] = useState<FormState>(blankForm);
  const [busy, setBusy] = useState(false);
  const trackers = state.status === "ready" ? state.data : [];
  const selected = trackers.find((t) => t.id === selectedId);

  useEffect(() => {
    if (draft) {
      setForm(blankForm());
      return;
    }
    if (!selectedId) return;
    const tracker = trackers.find((row) => row.id === selectedId);
    if (tracker) setForm(formFromTracker(tracker));
  }, [draft, selectedId]);

  function patchForm(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function create() {
    setBusy(true);
    try {
      const raw = await api<{ tracker?: unknown }>("/v1/anime-trackers", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          imageUrl: form.imageUrl.trim(),
          releaseAt: fromDatetimeLocal(form.releaseLocal),
          kind: form.kind,
          episode: Number(form.episode) || 1,
        }),
      });
      const tracker = parseAnimeTracker(raw.tracker);
      setForm(blankForm());
      if (tracker) onSelect(tracker.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      await api(`/v1/anime-trackers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: form.title.trim(),
          imageUrl: form.imageUrl.trim(),
          releaseAt: fromDatetimeLocal(form.releaseLocal),
          kind: form.kind,
          episode: Number(form.episode) || 1,
        }),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "active" | "paused") {
    setBusy(true);
    try {
      await api(`/v1/anime-trackers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await api(`/v1/anime-trackers/${id}`, { method: "DELETE" });
      onSelect(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    form.title.trim().length > 0 &&
    coverOk(form.imageUrl) &&
    form.releaseLocal.trim().length > 0;

  return (
    <div className="anime-panel">
      <p className="status-line">
        Weekly Resend reminder with cover art. Release time uses your local clock.
      </p>

      {!draft && !selected && (
        <div className="form-actions anime-panel-actions">
          <button type="button" className="btn btn-primary" onClick={onDraft}>
            New anime / manhwa
          </button>
        </div>
      )}

      {(draft || selected) && (
        <div className={`form anime-form${draft ? " is-draft" : " is-edit"}`}>
          {!draft && (
            <button type="button" className="btn anime-back" onClick={() => onSelect(null)}>
              ← Back to list
            </button>
          )}

          <div className="anime-form-preview">
            {coverOk(form.imageUrl) ? (
              <img
                className="anime-cover anime-cover-lg"
                src={form.imageUrl.trim()}
                alt=""
                loading="lazy"
              />
            ) : (
              <div className="anime-cover anime-cover-lg anime-cover-empty" aria-hidden>
                Cover
              </div>
            )}
            <div className="anime-form-fields">
              <input
                value={form.title}
                onChange={(e) => patchForm({ title: e.target.value })}
                placeholder="Title"
                autoComplete="off"
              />
              <input
                value={form.imageUrl}
                onChange={(e) => patchForm({ imageUrl: e.target.value })}
                placeholder="Cover image URL"
                inputMode="url"
                autoComplete="off"
              />
              <label className="anime-field-label">
                <span>Next release</span>
                <input
                  type="datetime-local"
                  value={form.releaseLocal}
                  onChange={(e) => patchForm({ releaseLocal: e.target.value })}
                />
              </label>
              <div className="anime-form-row">
                <select
                  value={form.kind}
                  onChange={(e) =>
                    patchForm({ kind: e.target.value === "manhwa" ? "manhwa" : "anime" })
                  }
                  aria-label="Kind"
                >
                  <option value="anime">Anime · Episode</option>
                  <option value="manhwa">Manhwa · Chapter</option>
                </select>
                <input
                  value={form.episode}
                  onChange={(e) => patchForm({ episode: e.target.value })}
                  placeholder={`${unitLabel(form.kind)} #`}
                  inputMode="numeric"
                  aria-label={`${unitLabel(form.kind)} number`}
                />
              </div>
            </div>
          </div>

          {selected && !draft && selected.lastError ? (
            <div className="anime-error">Last send error: {selected.lastError}</div>
          ) : null}

          <div className="form-actions">
            {draft ? (
              <>
                <button type="button" className="btn" onClick={() => onSelect(null)} disabled={busy}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !canSave}
                  onClick={() => void create()}
                >
                  Save tracker
                </button>
              </>
            ) : selected ? (
              <>
                {selected.status === "active" ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void setStatus(selected.id, "paused")}
                  >
                    Pause
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void setStatus(selected.id, "active")}
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void remove(selected.id)}
                >
                  Delete
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !canSave}
                  onClick={() => void saveEdit(selected.id)}
                >
                  Save changes
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {state.status === "loading" && <div className="status-line">Loading…</div>}
      {state.status === "error" && <div className="status-line">Error: {state.message}</div>}

      {!draft && !selected && state.status === "ready" && trackers.length === 0 ? (
        <div className="empty">No anime or manhwa trackers yet. Add a title, cover, and release time.</div>
      ) : null}

      {!draft && !selected && trackers.length > 0 ? (
        <div className="list anime-list">
          {trackers.map((tracker) => (
            <button
              key={tracker.id}
              type="button"
              className="row anime-row"
              onClick={() => onSelect(tracker.id)}
            >
              {coverOk(tracker.imageUrl) ? (
                <img
                  className="anime-cover"
                  src={tracker.imageUrl}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div className="anime-cover anime-cover-empty" aria-hidden />
              )}
              <div className="anime-row-copy">
                <div className="row-title">
                  <span>{tracker.title}</span>
                  <span className={`badge is-${tracker.status}`}>{tracker.status}</span>
                </div>
                <div className="row-body">
                  {unitLabel(tracker.kind)} {tracker.episode} · next{" "}
                  {formatRelativeTime(Date.parse(tracker.nextReleaseAt))}
                </div>
                <div className="row-meta">
                  {[
                    tracker.kind,
                    new Date(tracker.nextReleaseAt).toLocaleString(),
                    tracker.lastNotifiedAt
                      ? `emailed ${formatRelativeTime(Date.parse(tracker.lastNotifiedAt))}`
                      : "not emailed yet",
                  ].join(" · ")}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
