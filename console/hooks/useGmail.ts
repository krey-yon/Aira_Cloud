import { useCallback, useEffect, useState } from "react";
import { api, getToken } from "../api/client";

export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  scopes: string[];
  redirectUri: string | null;
};

export function useGmail(enabled: boolean) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await api<GmailStatus>("/v1/gmail");
      setStatus(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const id = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const gmail = url.searchParams.get("gmail");
    if (!gmail) return;
    const message = url.searchParams.get("message");
    if (gmail === "error" && message) setError(message);
    url.searchParams.delete("gmail");
    url.searchParams.delete("email");
    url.searchParams.delete("message");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    void refresh();
  }, [refresh]);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setError("Sign in with CLOUD_TOKEN first");
      return;
    }
    setBusy(true);
    window.location.href = `/auth/gmail?token=${encodeURIComponent(token)}`;
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await api("/v1/gmail", { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { status, error, busy, connect, disconnect, refresh };
}
