import { useState, type FormEvent } from "react";
import { setToken } from "../api/client";
import { BrandMark } from "./BrandMark";

type Props = {
  message?: string;
  onAuthed: () => void;
};

/** Modal popup when CLOUD_TOKEN is missing from localStorage. */
export function AuthGate({ message, onAuthed }: Props) {
  const [token, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = token.trim();
    if (!next) {
      setError("Paste your CLOUD_TOKEN");
      return;
    }
    setToken(next);
    setError(null);
    onAuthed();
  }

  return (
    <main className="stage canvas-aurora">
      <div className="canvas-vignette" aria-hidden />
      <div className="noise-overlay" aria-hidden />
      <div className="idle-copy idle-copy-inline" aria-hidden>
        <div>
          <h2>Aira Cloud</h2>
          <p>token required</p>
        </div>
      </div>
      <div className="token-popup-backdrop" role="presentation">
        <form
          className="glass token-popup"
          onSubmit={submit}
          role="dialog"
          aria-modal="true"
          aria-labelledby="aira-token-title"
        >
          <div className="auth-brand">
            <BrandMark />
            <div>
              <div className="brand-name" id="aira-token-title">
                Add cloud token
              </div>
              <div className="brand-meta" style={{ marginTop: "0.35rem" }}>
                <span className="pulse" />
                saved in this browser
              </div>
            </div>
          </div>
          <p className="auth-copy">
            {message ?? "Paste the same CLOUD_TOKEN your extension uses. It stays in localStorage on this device."}
          </p>
          <label className="auth-label" htmlFor="aira-token">
            Token
          </label>
          <input
            id="aira-token"
            className="auth-input"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={token}
            onChange={(e) => setValue(e.target.value)}
            placeholder="CLOUD_TOKEN"
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary auth-submit">
            Save & continue
          </button>
          <p className="auth-hint">
            Or open once with <code>/?token=…</code>
          </p>
        </form>
      </div>
    </main>
  );
}
