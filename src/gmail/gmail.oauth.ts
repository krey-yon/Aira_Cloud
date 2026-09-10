import { config } from "../config";
import { getGmailStore, type GmailAccount } from "./gmail.store";

export const GMAIL_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  email?: string;
  error?: { message?: string };
};

const pendingStates = new Map<string, { createdAt: number }>();

function pruneStates() {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [state, meta] of pendingStates) {
    if (meta.createdAt < cutoff) pendingStates.delete(state);
  }
}

export function gmailConfigured(): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret && config.gmailRedirectUri);
}

export function createGmailAuthUrl(): { url: string; state: string } {
  if (!gmailConfigured()) {
    throw new Error("Gmail OAuth is not configured (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)");
  }
  pruneStates();
  const state = crypto.randomUUID().replace(/-/g, "");
  pendingStates.set(state, { createdAt: Date.now() });
  getGmailStore().saveState(state);
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.gmailRedirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    state,
  };
}

export function consumeOAuthState(state: string | null): boolean {
  if (!state) return false;
  pruneStates();
  if (pendingStates.delete(state)) return true;
  return getGmailStore().consumeState(state);
}

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  return (await res.json()) as TokenResponse;
}

async function fetchEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as UserInfo;
  if (!data.email) {
    throw new Error(data.error?.message || "Google did not return an email");
  }
  return data.email;
}

export async function completeGmailOAuth(code: string): Promise<GmailAccount> {
  if (!gmailConfigured()) {
    throw new Error("Gmail OAuth is not configured");
  }
  const token = await exchangeToken({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.gmailRedirectUri,
    grant_type: "authorization_code",
  });
  if (!token.access_token) {
    throw new Error(token.error_description || token.error || "Token exchange failed");
  }
  const email = await fetchEmail(token.access_token);
  const expiryAt = Date.now() + Math.max(30, token.expires_in ?? 3600) * 1000;
  return getGmailStore().upsert({
    email,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? "",
    scope: token.scope ?? GMAIL_SCOPES.join(" "),
    tokenType: token.token_type ?? "Bearer",
    expiryAt,
  });
}

export async function getValidAccessToken(account = getGmailStore().primary()): Promise<string | null> {
  if (!account) return null;
  if (account.expiryAt > Date.now() + 60_000) return account.accessToken;
  if (!account.refreshToken || !gmailConfigured()) return null;

  const token = await exchangeToken({
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    refresh_token: account.refreshToken,
    grant_type: "refresh_token",
  });
  if (!token.access_token) return null;
  const updated = getGmailStore().upsert({
    email: account.email,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? account.refreshToken,
    scope: token.scope ?? account.scope,
    tokenType: token.token_type ?? account.tokenType,
    expiryAt: Date.now() + Math.max(30, token.expires_in ?? 3600) * 1000,
  });
  return updated.accessToken;
}

export function gmailStatus() {
  const account = getGmailStore().primary();
  return {
    configured: gmailConfigured(),
    connected: Boolean(account),
    email: account?.email ?? null,
    scopes: account?.scope?.split(/\s+/).filter(Boolean) ?? [...GMAIL_SCOPES],
    redirectUri: config.gmailRedirectUri || null,
  };
}
