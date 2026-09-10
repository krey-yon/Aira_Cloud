import type { GmailApi } from "../../hooks/useGmail";
import { MailBoard } from "../mail/MailBoard";
import { Sheet } from "../Sheet";

type Props = {
  gmail: GmailApi;
  onClose: () => void;
};

export function MailSheet({ gmail, onClose }: Props) {
  const connected = Boolean(gmail.status?.connected);
  const email = gmail.status?.email ?? null;

  return (
    <Sheet
      title="Mail"
      eyebrow={email ?? (connected ? "Connected" : "Not connected")}
      onClose={onClose}
      className="mail-panel"
      actions={
        connected ? (
          <button
            type="button"
            className="btn sheet-action"
            disabled={gmail.busy}
            onClick={() => void gmail.disconnect()}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            className="btn sheet-action"
            disabled={gmail.busy || !gmail.status?.configured}
            onClick={() => gmail.connect()}
          >
            Connect
          </button>
        )
      }
    >
      {gmail.error ? <div className="auth-error">{gmail.error}</div> : null}
      <MailBoard enabled connected={connected} />
    </Sheet>
  );
}
