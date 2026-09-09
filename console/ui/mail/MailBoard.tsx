import { useEffect, useState } from "react";
import {
  useMailBoard,
  type MailDraft,
  type RecentMail,
} from "../../hooks/useMailBoard";
import { MailDraftCard, MailRecentCard } from "./MailCard";
import { MailReaderModal } from "./MailReaderModal";
import { MailToast, useMailToast } from "./MailToast";

type Reader =
  | { kind: "draft" | "scheduled"; data: MailDraft }
  | { kind: "recent"; data: RecentMail }
  | null;

type Props = {
  enabled: boolean;
};

export function MailBoard({ enabled }: Props) {
  const { board, error, busy, sendNow, discard, loadMessage } = useMailBoard(enabled);
  const { message, push } = useMailToast();
  const [reader, setReader] = useState<Reader>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReader(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openRecent = async (item: RecentMail) => {
    setReader({ kind: "recent", data: item });
    try {
      const full = await loadMessage(item.id);
      setReader({ kind: "recent", data: { ...item, body: full.body || item.body } });
    } catch {
      // Keep snippet body.
    }
  };

  const empty =
    board.drafts.length === 0 &&
    board.scheduled.length === 0 &&
    board.recent.length === 0;

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
            {board.drafts.length === 0 && (
              <p className="mail-empty">No drafts yet</p>
            )}
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
            {board.scheduled.length === 0 && (
              <p className="mail-empty">Nothing scheduled</p>
            )}
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
            {board.recent.length === 0 && (
              <p className="mail-empty">
                {error ? error : "Connect Gmail to load recent mail"}
              </p>
            )}
          </div>
        </section>
      </div>

      {empty && !error && (
        <div className="mail-idle-hint">
          Draft with Aira, then manage sends here. Dock stays below.
        </div>
      )}

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
