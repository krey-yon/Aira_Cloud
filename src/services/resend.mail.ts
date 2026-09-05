import { config } from "../config";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] || ch,
  );
}

export function buildWatcherEmailHtml(input: {
  title: string;
  body: string;
  resourceUrl?: string;
  observed?: string;
  consoleUrl?: string;
}) {
  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body).replace(/\n/g, "<br/>");
  const observed = input.observed ? escapeHtml(input.observed) : "";
  const resource = input.resourceUrl ? escapeHtml(input.resourceUrl) : "";
  const consoleUrl = escapeHtml(input.consoleUrl || "https://aira.kreyon.in");
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0b0c10;color:#f4f5f8;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 18px;">
    <div style="border:1px solid #232635;border-radius:18px;overflow:hidden;background:linear-gradient(160deg,#12131c,#0b0c10 60%);">
      <div style="padding:22px 22px 8px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7e849a;">Aira watcher</div>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:#fff;">${title}</h1>
      </div>
      <div style="padding:8px 22px 22px;">
        <p style="margin:0 0 14px;color:#c2c6d2;font-size:15px;line-height:1.55;">${body}</p>
        ${
          observed
            ? `<div style="margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#171925;border:1px solid #232635;color:#a4a9ba;font-size:13px;"><strong style="color:#e0e2e9;">Observed</strong><div style="margin-top:6px;word-break:break-word;">${observed}</div></div>`
            : ""
        }
        ${
          resource
            ? `<p style="margin:0 0 18px;font-size:13px;"><a href="${resource}" style="color:#7c6cff;text-decoration:none;word-break:break-all;">${resource}</a></p>`
            : ""
        }
        <a href="${consoleUrl}" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#7c6cff;color:#fff;font-size:13px;font-weight:650;text-decoration:none;">Open Aira console</a>
      </div>
    </div>
    <p style="margin:16px 8px 0;color:#555a70;font-size:12px;">Sent by Aira · aira@kreyon.in</p>
  </div>
</body>
</html>`;
}

export async function sendWatcherEmail(input: {
  subject: string;
  title: string;
  body: string;
  resourceUrl?: string;
  observed?: string;
}): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = config.resendApiKey.trim();
  if (!apiKey) return { ok: false, error: "RESEND API key is not configured on the cloud server." };

  const to = config.notifyEmail.trim();
  const from = config.resendFrom.trim() || "Aira <aira@kreyon.in>";
  const html = buildWatcherEmailHtml({
    ...input,
    consoleUrl: (config.publicBaseUrl.trim() || "https://aira.kreyon.in").replace(/\/$/, ""),
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        html,
        text: `${input.title}\n\n${input.body}${input.resourceUrl ? `\n\n${input.resourceUrl}` : ""}`,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${text.slice(0, 200)}` };
    }
    const json = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
