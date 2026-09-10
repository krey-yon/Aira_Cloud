import type { CanvasRecord } from "./canvas.store";
import { renderMarkdown } from "../shared/markdown";

export function canvasPage(record: CanvasRecord) {
  const bodyHtml = renderMarkdown(record.markdown);
  const title = record.title.replace(/</g, "&lt;");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Aira</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #070812;
      --fg: #e8eef4;
      --muted: #9aa7b5;
      --card: color-mix(in srgb, #141820 88%, transparent);
      --accent: #5ec4a8;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f3f4f2;
        --fg: #15202b;
        --muted: #5b6b7a;
        --card: color-mix(in srgb, #ffffff 90%, transparent);
        --accent: #1f7a64;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--fg);
      font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      background:
        radial-gradient(ellipse 70% 55% at 12% -6%, color-mix(in srgb, #3a5248 32%, transparent), transparent 62%),
        radial-gradient(ellipse 55% 48% at 88% 4%, color-mix(in srgb, #3d4f5c 22%, transparent), transparent 64%),
        linear-gradient(155deg, #0c1014, var(--bg) 52%);
    }
    @media (prefers-color-scheme: light) {
      body {
        background:
          radial-gradient(ellipse 62% 52% at 8% -4%, color-mix(in srgb, #7a9586 20%, transparent), transparent 64%),
          radial-gradient(ellipse 52% 44% at 94% 8%, color-mix(in srgb, #8494a3 14%, transparent), transparent 66%),
          linear-gradient(155deg, #eef1ee, var(--bg));
      }
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' fill='%23000'/%3E%3Ccircle cx='1' cy='1' r='0.75' fill='%23fff'/%3E%3Ccircle cx='5' cy='3' r='0.75' fill='%23fff'/%3E%3Ccircle cx='3' cy='5' r='0.75' fill='%23fff'/%3E%3Ccircle cx='7' cy='7' r='0.75' fill='%23fff'/%3E%3C/svg%3E"),
        url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      background-size: 8px 8px, 220px 220px;
      mix-blend-mode: overlay;
      opacity: 0.22;
    }
    @media (prefers-color-scheme: light) {
      body::before { mix-blend-mode: multiply; opacity: 0.12; }
    }
    main {
      position: relative;
      z-index: 1;
      width: min(720px, calc(100% - 32px));
      margin: 48px auto 80px;
      padding: 28px 28px 36px;
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--fg) 10%, transparent);
      background: var(--card);
      backdrop-filter: blur(18px) saturate(140%);
      box-shadow: 0 24px 60px rgba(0,0,0,.22);
    }
    header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 22px; }
    header strong { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
    header time { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
    h1 { margin: 0 0 18px; font-size: 1.55rem; line-height: 1.25; letter-spacing: -0.02em; }
    .md p { margin: 0 0 0.9em; }
    .md h1, .md h2, .md h3 { margin: 1.2em 0 0.45em; line-height: 1.25; }
    .md ul, .md ol { margin: 0 0 0.9em; padding-left: 1.25em; }
    .md code { padding: .1em .35em; border-radius: 4px; background: color-mix(in srgb, var(--fg) 8%, transparent); font: 600 0.88em/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .md pre { padding: 12px; border-radius: 10px; overflow: auto; background: color-mix(in srgb, #000 35%, transparent); }
    .md a { color: var(--accent); }
  </style>
</head>
<body>
  <main>
    <header>
      <strong>Aira canvas</strong>
      <time datetime="${record.createdAt}">${record.createdAt.slice(0, 19).replace("T", " ")} UTC</time>
    </header>
    <h1>${title}</h1>
    <article class="md">${bodyHtml}</article>
  </main>
</body>
</html>`;
}
