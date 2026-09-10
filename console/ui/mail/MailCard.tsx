import { formatRelativeTime } from "../../lib/relative-time";
import type { MailDraft, RecentMailCard } from "../../hooks/useMailBoard";

type DraftProps = {
  item: MailDraft;
  variant: "draft" | "scheduled";
  busy?: boolean;
  onOpen: () => void;
  onSendNow: () => void;
  onDiscard: () => void;
};

type RecentProps = {
  item: RecentMailCard;
  onOpen: () => void;
};

function snip(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function MailDraftCard({
  item,
  variant,
  busy,
  onOpen,
  onSendNow,
  onDiscard,
}: DraftProps) {
  return (
    <article className="mail-card" onClick={onOpen} role="button" tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="mail-card-top">
        <span className="mail-score">{item.importance?.score ?? "—"}</span>
        <span className={variant === "scheduled" ? "mail-when" : "mail-muted"}>
          {variant === "scheduled" ? item.runAt || "scheduled" : "draft"}
        </span>
      </div>
      <div className="mail-to">{item.to.join(", ")}</div>
      <div className="mail-subj">{item.subject}</div>
      <div className="mail-snip">{snip(item.body)}</div>
      {item.templateId ? <span className="mail-pill">{item.templateId}</span> : null}
      <div className="mail-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="mail-chip danger" disabled={busy} onClick={onDiscard}>
          Discard
        </button>
        <button type="button" className="mail-chip send" disabled={busy} onClick={onSendNow}>
          Send now
        </button>
      </div>
    </article>
  );
}

export function MailRecentCard({ item, onOpen }: RecentProps) {
  return (
    <article
      className="mail-card"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="mail-card-top">
        <span className="mail-muted mail-from">{item.fromName || item.from}</span>
        <span className="mail-muted">{formatRelativeTime(item.date)}</span>
      </div>
      <div className="mail-subj">{item.subject || "(no subject)"}</div>
      <div className="mail-snip">{item.preview}</div>
    </article>
  );
}
