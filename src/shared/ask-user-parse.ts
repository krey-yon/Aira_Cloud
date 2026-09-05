/** Parse model-emitted <ask_user>…</ask_user> blocks into a structured question. */

export type AskUserOption = { id: string; label: string };

export type ParsedAskUser = {
  prompt: string;
  options: AskUserOption[];
  allowFreeText: boolean;
  placeholder?: string;
  /** Original text with the ask_user block removed. */
  remainder: string;
};

const ASK_USER_RE = /<ask_user>\s*([\s\S]*?)\s*<\/ask_user>/i;

function asOptions(raw: unknown): AskUserOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? `opt_${index + 1}`).trim();
      const label = String(row.label ?? row.text ?? "").trim();
      if (!id || !label) return null;
      return { id, label };
    })
    .filter((item): item is AskUserOption => Boolean(item));
}

export function extractAskUser(text: string): ParsedAskUser | null {
  const match = text.match(ASK_USER_RE);
  if (!match) return null;

  const payload = match[1]!.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const row = parsed as Record<string, unknown>;
  const prompt = String(row.prompt ?? row.question ?? row.message ?? "").trim();
  if (!prompt) return null;

  const options = asOptions(row.options);
  const allowFreeText = row.allowFreeText !== false;
  if (options.length < 2 && !allowFreeText) return null;

  const placeholder =
    typeof row.placeholder === "string" && row.placeholder.trim()
      ? row.placeholder.trim()
      : undefined;

  const remainder = text.replace(match[0], "").replace(/\n{3,}/g, "\n\n").trim();

  return { prompt, options, allowFreeText, placeholder, remainder };
}

export function stripAskUser(text: string): string {
  return text.replace(ASK_USER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
