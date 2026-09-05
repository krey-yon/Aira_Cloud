/** Escape HTML, then apply a small Markdown subset for agent widget bodies. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdown(escaped: string): string {
  let out = escaped;
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  // Single * / _ after bold/code so we do not re-enter strong markers.
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  return out;
}

/**
 * Render a constrained Markdown subset to HTML.
 * Input is escaped first so raw HTML from the model cannot execute.
 */
export function renderMarkdown(source: string): string {
  const text = source.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const lines = text.split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (/^```/.test(line)) {
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i]!)) {
        fence.push(lines[i]!);
        i += 1;
      }
      i += 1;
      blocks.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = Math.min(3, line.match(/^#+/)![0].length);
      const content = inlineMarkdown(escapeHtml(line.replace(/^#{1,3}\s+/, "")));
      blocks.push(`<h${level}>${content}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i]!)) {
        items.push(
          `<li>${inlineMarkdown(escapeHtml(lines[i]!.replace(/^\s*[-*]\s+/, "")))}</li>`,
        );
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i]!)) {
        items.push(
          `<li>${inlineMarkdown(escapeHtml(lines[i]!.replace(/^\s*\d+\.\s+/, "")))}</li>`,
        );
        i += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^```|^#{1,3}\s+|^\s*[-*]\s+|^\s*\d+\.\s+/.test(lines[i]!)
    ) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push(`<p>${inlineMarkdown(escapeHtml(para.join("\n")))}</p>`);
  }

  return blocks.join("");
}
