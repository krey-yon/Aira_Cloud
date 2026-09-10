import { useEffect, useState } from "react";
import {
  useMailBoard,
  type MailDraft,
  type RecentMailCard,
  type RecentMailMessage,
} from "./useMailBoard";
import { MailDraftCard, MailRecentCard } from "./MailCard";
import { MailReaderModal } from "./MailReaderModal";
import { MailToast, useMailToast } from "./MailToast";

type Reader =
  | { kind: "draft" | "scheduled"; data: MailDraft }
  | { kind: "recent"; data: RecentMailMessage }
  | null;

type Props = {
  enabled: boolean;
  connected?: boolean;
};

function laneCopy(loading: boolean, count: number, idle: string) {
  if (count > 0) return null;
  return loading ? "Loading…" : idle;
}

export function MailBoard({ enabled, connected }: Props) {
  const { board, error, busy, loading, sendNow, discard, loadMessage } = useMailBoard(enabled);
  const { message, push } = useMailToast();
  const [reader, setReader] = useState<Reader>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !reader) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      setReader(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [reader]);

  const openRecent = async (item: RecentMailCard) => {
    setReader({ kind: "recent", data: { ...item, body: "" } });
    try {
      const full = await loadMessage(item.id);
      setReader({ kind: "recent", data: { ...item, body: full.body || "" } });
    } catch {
      setReader({ kind: "recent", data: { ...item, body: item.preview || "(couldn't load)" } });
    }
  };

  const recentIdle = error
    ? error
    : connected
      ? "No recent mail"
      : "Connect Gmail to load recent mail";
  const draftsEmpty = laneCopy(loading, board.drafts.length, "No drafts yet");
  const scheduledEmpty = laneCopy(loading, board.scheduled.length, "Nothing scheduled");
  const recentEmpty = laneCopy(loading, board.recent.length, recentIdle);

  return (
    <>
      <div className="mail-board" aria-label="Mail lanes">
        <section className="mail-lane">
          <header className="mail-lane-head">
            <h2>Draft</h2>
            <span>{board.drafts.length}</span>
          </header>
          <div className="mail-lane-body">
            {board.drafts.map((item, i) => (
              <div key={item.id} className="mail-card-wrap" style={{ animationDelay: `${i * 40}ms` }}>
                <MailDraftCard
                  item={item}
                  variant="draft"
                  busy={busy}
                  onOpen={() => setReader({ kind: "draft", data: item })}
                  onSendNow={async () => {
                    await sendNow(item.id);
                    push("Sent");
                    setReader(null);
                  }}
                  onDiscard={async () => {
                    await discard(item.id);
                    push("Discarded");
                    setReader(null);
                  }}
                />
              </div>
            ))}
            {draftsEmpty ? <p className="mail-empty">{draftsEmpty}</p> : null}
          </div>
        </section>

        <section className="mail-lane">
          <header className="mail-lane-head">
            <h2>Scheduled</h2>
            <span>{board.scheduled.length}</span>
          </header>
          <div className="mail-lane-body">
            {board.scheduled.map((item, i) => (
              <div key={item.id} className="mail-card-wrap" style={{ animationDelay: `${i * 40}ms` }}>
                <MailDraftCard
                  item={item}
                  variant="scheduled"
                  busy={busy}
                  onOpen={() => setReader({ kind: "scheduled", data: item })}
                  onSendNow={async () => {
                    await sendNow(item.id);
                    push("Sent now");
                    setReader(null);
                  }}
                  onDiscard={async () => {
                    await discard(item.id);
                    push("Cancelled");
                    setReader(null);
                  }}
                />
              </div>
            ))}
            {scheduledEmpty ? <p className="mail-empty">{scheduledEmpty}</p> : null}
          </div>
        </section>

        <section className="mail-lane">
          <header className="mail-lane-head">
            <h2>Recent mail</h2>
            <span>last 5</span>
          </header>
          <div className="mail-lane-body">
            {board.recent.map((item, i) => (
              <div key={item.id} className="mail-card-wrap" style={{ animationDelay: `${i * 40}ms` }}>
                <MailRecentCard item={item} onOpen={() => void openRecent(item)} />
              </div>
            ))}
            {recentEmpty ? <p className="mail-empty">{recentEmpty}</p> : null}
          </div>
        </section>
      </div>

      <MailToast message={message} />
      <MailReaderModal
        open={Boolean(reader)}
        item={reader}
        busy={busy}
        onClose={() => setReader(null)}
        onSendNow={
          reader && reader.kind !== "recent"
            ? async () => {
                await sendNow(reader.data.id);
                push("Sent now");
                setReader(null);
              }
            : undefined
        }
        onDiscard={
          reader && reader.kind !== "recent"
            ? async () => {
                await discard(reader.data.id);
                push(reader.kind === "scheduled" ? "Cancelled" : "Discarded");
                setReader(null);
              }
            : undefined
        }
      />
    </>
  );
}
