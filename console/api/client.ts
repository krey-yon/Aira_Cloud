const TOKEN_KEY = "airaCloudToken";

export function ensureTokenFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("aira:unauthorized", { detail: { status: 401 } }));
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export async function probeAuth(): Promise<"ok" | "unauthorized" | "error"> {
  try {
    await api<{ skills?: unknown }>("/v1/skills");
    return "ok";
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return "unauthorized";
    return "error";
  }
}
