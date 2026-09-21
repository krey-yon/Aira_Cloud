import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { parseStoreDump, storeEntries, type StoreEntry } from "../../../src/store/domain";
import { Sheet } from "../../shell/Sheet";

type Props = {
  onClose: () => void;
};

export function StoreSheet({ onClose }: Props) {
  const [entries, setEntries] = useState<StoreEntry[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const dump = parseStoreDump(await api<unknown>("/v1/store"));
    setEntries(storeEntries(dump.store));
  }, []);

  useEffect(() => {
    void reload().catch((err) => setStatus(String(err)));
  }, [reload]);

  async function save() {
    const nextKey = key.trim();
    if (!nextKey) {
      setStatus("Key is required");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await api("/v1/store", {
        method: "PUT",
        body: JSON.stringify({ key: nextKey, value }),
      });
      setKey("");
      setValue("");
      await reload();
      setStatus("Saved");
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(entryKey: string) {
    setBusy(true);
    setStatus(null);
    try {
      await api("/v1/store", {
        method: "DELETE",
        body: JSON.stringify({ key: entryKey }),
      });
      await reload();
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet title="Store" eyebrow="console" onClose={onClose}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="auth-label" htmlFor="store-key">
          Key
        </label>
        <input
          id="store-key"
          className="auth-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="email-sig"
        />
        <label className="auth-label" htmlFor="store-value">
          Value
        </label>
        <textarea
          id="store-value"
          className="auth-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Best,"
        />
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Save
          </button>
        </div>
      </form>
      {status ? <p className="status-line">{status}</p> : null}
      <div className="list">
        {entries.length === 0 ? (
          <div className="empty">No store entries yet.</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.key} className="row">
              <div className="row-title">
                <span>{entry.key}</span>
              </div>
              <div className="row-body">{entry.value}</div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => void remove(entry.key)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}
