import { useState, type FormEvent } from "react";
import { setToken } from "../api/client";
import { BrandMark } from "./BrandMark";

type Props = {
  message?: string;
  onAuthed: () => void;
};

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
      <div className="auth-wrap">
        <form className="glass auth-card" onSubmit={submit}>
          <div className="auth-brand">
            <BrandMark />
            <div>
              <div className="brand-name">Aira</div>
              <div className="brand-meta" style={{ marginTop: "0.35rem" }}>
                <span className="pulse" />
                cloud console
              </div>
            </div>
          </div>
          <p className="auth-copy">
            {message ?? "Enter the same CLOUD_TOKEN your extension uses."}
          </p>
          <label className="auth-label" htmlFor="aira-token">
            Token
          </label>
          <input
            id="aira-token"
            className="auth-input"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(e) => setValue(e.target.value)}
            placeholder="CLOUD_TOKEN"
          />
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="btn btn-primary auth-submit">
            Continue
          </button>
          <p className="auth-hint">
            Or open <code>/?token=…</code> once. Connect Gmail after you enter the console.
          </p>
        </form>
      </div>
    </main>
  );
}
