import type { GmailStatus } from "../hooks/useGmail";

type Props = {
  status: GmailStatus | null;
  error: string | null;
  busy: boolean;
  onConnect: () => void;
};

/** Connected state is read-only on the canvas — no Disconnect control. */
export function GmailCard({ status, error, busy, onConnect }: Props) {
  return (
    <div className="gmail-card glass">
      <div className="gmail-card-title">Gmail</div>
      {status?.connected ? (
        <>
          <p className="gmail-card-copy">Connected and ready for send + read.</p>
          <div className="gmail-email">{status.email}</div>
          <div className="gmail-scopes">
            {(status.scopes ?? []).filter((s) => s.includes("gmail")).join(" · ") || "gmail scopes"}
          </div>
        </>
      ) : (
        <>
          <p className="gmail-card-copy">
            Connect with send + read scopes so Aira can use your mailbox.
          </p>
          {!status?.configured && (
            <div className="auth-error">
              Set CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI in cloud .env
            </div>
          )}
          {status?.redirectUri && (
            <div className="gmail-scopes">Redirect: {status.redirectUri}</div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !status?.configured}
            onClick={onConnect}
          >
            Connect Gmail
          </button>
        </>
      )}
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
