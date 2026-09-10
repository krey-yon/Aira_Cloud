import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

export type MailDraft = {
  id: string;
  to: string[];
  subject: string;
  body: string;
  status: string;
  templateId?: string;
  importance?: { score: number; label: string; reasons: string[] };
  runAt?: string;
  scheduleTaskId?: string;
};

export type RecentMailCard = {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  date: string;
};

export type RecentMailMessage = RecentMailCard & {
  body: string;
};

export type MailBoard = {
  drafts: MailDraft[];
  scheduled: MailDraft[];
  recent: RecentMailCard[];
};

const empty: MailBoard = { drafts: [], scheduled: [], recent: [] };

export function useMailBoard(enabled: boolean) {
  const [board, setBoard] = useState<MailBoard>(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const next = await api<MailBoard>("/v1/mail/board");
      setBoard({
        drafts: next.drafts ?? [],
        scheduled: next.scheduled ?? [],
        recent: (next.recent ?? []).slice(0, 5),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    const id = window.setInterval(() => void refresh(), 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, refresh]);

  const sendNow = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await api(`/v1/mail/drafts/${encodeURIComponent(id)}/send`, { method: "POST" });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const discard = useCallback(
    async (id: string) => {
      setBusy(true);
      try {
        await api(`/v1/mail/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const loadMessage = useCallback(async (id: string) => {
    const raw = await api<{ message: RecentMailMessage }>(
      `/v1/mail/messages/${encodeURIComponent(id)}`,
    );
    return raw.message;
  }, []);

  return { board, error, busy, loading, refresh, sendNow, discard, loadMessage };
}
