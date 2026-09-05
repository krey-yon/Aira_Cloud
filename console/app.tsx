import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  clearToken,
  ensureTokenFromUrl,
  getToken,
  probeAuth,
} from "./api/client";
import { useTheme } from "./hooks/useTheme";
import { useConsoleNav } from "./state/useConsoleNav";
import { AuthGate } from "./ui/AuthGate";
import { ConsoleStage } from "./ui/ConsoleStage";

ensureTokenFromUrl();

type Gate = "checking" | "need-token" | "ready";

function App() {
  const [gate, setGate] = useState<Gate>(() => (getToken() ? "checking" : "need-token"));
  const [authMessage, setAuthMessage] = useState<string | undefined>();
  const { nav, open, close, select, setFilter, startDraft } = useConsoleNav();
  const { theme, toggleTheme } = useTheme();

  const verify = useCallback(async () => {
    if (!getToken()) {
      setGate("need-token");
      return;
    }
    setGate("checking");
    const result = await probeAuth();
    if (result === "ok") {
      setAuthMessage(undefined);
      setGate("ready");
      return;
    }
    clearToken();
    setAuthMessage(
      result === "unauthorized"
        ? "That token was rejected. Paste the CLOUD_TOKEN from your cloud .env."
        : "Could not reach the API. Is the cloud server running?",
    );
    setGate("need-token");
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  useEffect(() => {
    const onUnauthorized = () => {
      clearToken();
      setAuthMessage("Session expired or token invalid. Sign in again.");
      setGate("need-token");
    };
    window.addEventListener("aira:unauthorized", onUnauthorized);
    return () => window.removeEventListener("aira:unauthorized", onUnauthorized);
  }, []);

  if (gate === "checking") {
    return (
      <main className="stage canvas-aurora">
        <div className="canvas-vignette" aria-hidden />
        <div className="noise-overlay" aria-hidden />
        <div className="idle-copy">
          <div>
            <h2>Checking access…</h2>
            <p>verifying token</p>
          </div>
        </div>
      </main>
    );
  }

  if (gate === "need-token") {
    return <AuthGate message={authMessage} onAuthed={() => void verify()} />;
  }

  return (
    <ConsoleStage
      nav={nav}
      theme={theme}
      onOpen={open}
      onClose={close}
      onSelect={select}
      onFilter={setFilter}
      onDraft={startDraft}
      onToggleTheme={toggleTheme}
    />
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(<App />);
