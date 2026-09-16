function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] || ch,
  );
}

export function buildAnimeEmailHtml(input: {
  title: string;
  imageUrl: string;
  kind: "anime" | "manhwa";
  episode: number;
  consoleUrl?: string;
}) {
  const title = escapeHtml(input.title);
  const imageUrl = escapeHtml(input.imageUrl);
  const consoleUrl = escapeHtml(input.consoleUrl || "https://aira.kreyon.in");
  const unit = input.kind === "manhwa" ? "Chapter" : "Episode";
  const eyebrow = input.kind === "manhwa" ? "Aira manhwa" : "Aira anime";
  const headline = `${unit} ${input.episode} is out`;
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#0b0c10;color:#f4f5f8;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:28px 18px;">
    <div style="border:1px solid #232635;border-radius:18px;overflow:hidden;background:linear-gradient(160deg,#12131c,#0b0c10 60%);">
      <img src="${imageUrl}" alt="${title}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;background:#171925;"/>
      <div style="padding:22px 22px 8px;">
        <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7e849a;">${eyebrow}</div>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.25;color:#fff;">${title}</h1>
      </div>
      <div style="padding:8px 22px 22px;">
        <p style="margin:0 0 14px;color:#c2c6d2;font-size:15px;line-height:1.55;">${headline}.</p>
        <p style="margin:0 0 18px;color:#a4a9ba;font-size:13px;line-height:1.5;">Aira will remind you again in 7 days.</p>
        <a href="${consoleUrl}" style="display:inline-block;padding:11px 16px;border-radius:999px;background:#7c6cff;color:#fff;font-size:13px;font-weight:650;text-decoration:none;">Open Aira console</a>
      </div>
    </div>
    <p style="margin:16px 8px 0;color:#555a70;font-size:12px;">Sent by Aira · aira@kreyon.in</p>
  </div>
</body>
</html>`;
}
