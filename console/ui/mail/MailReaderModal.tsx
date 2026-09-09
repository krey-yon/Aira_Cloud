import type { MailDraft, RecentMail } from "../../hooks/useMailBoard";

type Item =
  | { kind: "draft" | "scheduled"; data: MailDraft }
  | { kind: "recent"; data: RecentMail };

type Props = {
  open: boolean;
  item: Item | null;
  busy?: boolean;
  onClose: () => void;
  onSendNow?: () => void;
  onDiscard?: () => void;
};

export function MailReaderModal({
  open,
  item,
  busy,
  onClose,
  onSendNow,
  onDiscard,
}: Props) {
  if (!open || !item) return null;

  const subject =
    item.kind === "recent" ? item.data.subject : item.data.subject;
  const sub =
    item.kind === "recent"
      ? `from ${item.data.from}`
      : `to ${item.data.to.join(", ")}${item.data.runAt ? ` · ${item.data.runAt}` : ""}`;
  const body = item.data.body || ("snippet" in item.data ? item.data.snippet : "");

  return (
    <div className="mail-scrim" onClick={onClose} role="presentation">
      <div
        className="mail-modal glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mail-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mail-modal-head">
          <div>
            <h2 id="mail-modal-title">{subject || "(no subject)"}</h2>
            <p>{sub}</p>
          </div>
          <button type="button" className="mail-modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="mail-modal-body">{body}</div>
        {(item.kind === "draft" || item.kind === "scheduled") && (
          <div className="mail-modal-foot">
            <button
              type="button"
              className="mail-chip danger"
              disabled={busy}
              onClick={onDiscard}
            >
              Discard
            </button>
            <button
              type="button"
              className="mail-chip send"
              disabled={busy}
              onClick={onSendNow}
            >
              Send now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
