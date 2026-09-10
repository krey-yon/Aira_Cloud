import { config } from "../config";

type McpContentItem = { type?: string; text?: string };
type McpEnvelope = {
  result?: { content?: McpContentItem[] };
  error?: { message?: string; code?: number };
};

export function exaMcpUrl(tools?: string[]): string {
  const params = new URLSearchParams();
  if (config.exaApiKey) {
    params.set("exaApiKey", config.exaApiKey);
  }
  if (tools?.length) {
    params.set("tools", tools.join(","));
  }
  const qs = params.toString();
  return qs ? `https://mcp.exa.ai/mcp?${qs}` : "https://mcp.exa.ai/mcp";
}

function parseMcpPayload(payload: string): {
  text?: string;
  error?: string;
} {
  const trimmed = payload.trim();
  if (!trimmed.startsWith("{")) return {};
  try {
    const data = JSON.parse(trimmed) as McpEnvelope;
    if (data.error?.message) {
      return { error: data.error.message };
    }
    const text = data.result?.content?.find((item) => item.text)?.text;
    return text ? { text } : {};
  } catch {
    return {};
  }
}

function parseMcpResponse(body: string): { text?: string; error?: string } {
  const direct = parseMcpPayload(body);
  if (direct.text || direct.error) return direct;

  for (const line of body.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const data = parseMcpPayload(line.slice(6));
    if (data.text || data.error) return data;
  }
  return {};
}

export async function callExaMcp(
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<string> {
  if (!config.exaApiKey) {
    throw new Error("EXA_KEY is required for Exa web tools");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(exaMcpUrl([name]), {
      method: "POST",
      headers: {
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
        "x-api-key": config.exaApiKey,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: args },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Exa MCP HTTP ${response.status} ${response.statusText}`);
    }

    const body = await response.text();
    const parsed = parseMcpResponse(body);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (!parsed.text) {
      throw new Error("Exa returned no content");
    }
    return parsed.text;
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      throw new Error("Exa request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
