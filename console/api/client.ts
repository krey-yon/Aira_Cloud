const TOKEN_KEY = "airaCloudToken";
const COOKIE_NAME = "airaCloudToken";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function ensureTokenFromUrl() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (token) {
    setToken(token);
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }
}

export function getToken(): string | null {
  try {
    const match = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${COOKIE_NAME}=`));
    if (match) {
      const value = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
      if (value) return value;
    }
  } catch {}
  try {
    const local = localStorage.getItem(TOKEN_KEY);
    if (local) return local;
    // migrate older session-only tokens
    const session = sessionStorage.getItem(TOKEN_KEY);
    if (session) {
      localStorage.setItem(TOKEN_KEY, session);
      sessionStorage.removeItem(TOKEN_KEY);
      return session;
    }
  } catch {}
  return null;
}

export function setToken(token: string) {
  const next = token.trim();
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${COOKIE_NAME}=${encodeURIComponent(next)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  } catch {}
  try {
    localStorage.setItem(TOKEN_KEY, next);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    try {
      sessionStorage.setItem(TOKEN_KEY, next);
    } catch {}
  }
}

export function clearToken() {
  try {
    document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {}
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
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
