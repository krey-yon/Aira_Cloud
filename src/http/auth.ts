import { config } from "../config";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

export function extractBearer(req: Request): string | undefined {
  const header = req.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (match?.[1]) return match[1].trim();
  const url = new URL(req.url);
  return url.searchParams.get("token")?.trim() || undefined;
}

export function authorize(token?: string): boolean {
  if (!config.cloudToken) return true;
  return Boolean(token && token === config.cloudToken);
}

export function requireAuth(req: Request): Response | null {
  if (authorize(extractBearer(req))) return null;
  return json({ error: "Unauthorized" }, 401);
}

export async function readJson<T>(req: Request): Promise<{ ok: true; body: T } | { ok: false; response: Response }> {
  try {
    const body = (await req.json()) as T;
    return { ok: true, body };
  } catch {
    return { ok: false, response: json({ error: "Invalid JSON body" }, 400) };
  }
}
