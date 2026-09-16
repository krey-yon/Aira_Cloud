import { config, publicOrigin } from "../config";
import { buildAnimeEmailHtml } from "../mail/templates";
import { unitLabel } from "./anime.schedule";
import type { AnimeTracker } from "./anime.store";

export { buildAnimeEmailHtml };

export async function sendAnimeEmail(
  tracker: AnimeTracker,
): Promise<{ ok: true; id?: string } | { ok: false; error: string }> {
  const apiKey = config.resendApiKey.trim();
  if (!apiKey) return { ok: false, error: "RESEND API key is not configured on the cloud server." };

  const to = config.notifyEmail.trim();
  const from = config.resendFrom.trim() || "Aira <aira@kreyon.in>";
  const unit = unitLabel(tracker.kind);
  const subject = `Aira · ${tracker.title} · ${unit} ${tracker.episode}`;
  const html = buildAnimeEmailHtml({
    title: tracker.title,
    imageUrl: tracker.imageUrl,
    kind: tracker.kind,
    episode: tracker.episode,
    consoleUrl: publicOrigin(),
  });
  const text = `${tracker.title}\n\n${unit} ${tracker.episode} is out.`;

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
        subject,
        html,
        text,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend ${response.status}: ${body.slice(0, 200)}` };
    }
    const json = (await response.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
