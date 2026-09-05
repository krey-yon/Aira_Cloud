import { Database } from "bun:sqlite";

import { config } from "../config";

export type GmailAccount = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  expiryAt: number;
  createdAt: number;
  updatedAt: number;
};

type Row = {
  id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_at: number;
  created_at: number;
  updated_at: number;
};

function rowToAccount(row: Row): GmailAccount {
  return {
    id: row.id,
    email: row.email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    scope: row.scope,
    tokenType: row.token_type,
    expiryAt: row.expiry_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GmailStore {
  private readonly db: Database;

  constructor(dbPath = config.gmailDbPath) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gmail_accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        scope TEXT NOT NULL,
        token_type TEXT NOT NULL,
        expiry_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS gmail_oauth_states (
        state TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL
      );
    `);
  }

  saveState(state: string) {
    this.db
      .query(`INSERT OR REPLACE INTO gmail_oauth_states (state, created_at) VALUES (?, ?)`)
      .run(state, Date.now());
  }

  consumeState(state: string): boolean {
    this.db
      .query(`DELETE FROM gmail_oauth_states WHERE created_at < ?`)
      .run(Date.now() - 10 * 60_000);
    const row = this.db
      .query(`SELECT state FROM gmail_oauth_states WHERE state = ?`)
      .get(state) as { state: string } | null;
    if (!row) return false;
    this.db.query(`DELETE FROM gmail_oauth_states WHERE state = ?`).run(state);
    return true;
  }

  upsert(input: {
    email: string;
    accessToken: string;
    refreshToken: string;
    scope: string;
    tokenType: string;
    expiryAt: number;
  }): GmailAccount {
    const existing = this.getByEmail(input.email);
    const now = Date.now();
    const id = existing?.id ?? `gmail_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const refreshToken = input.refreshToken || existing?.refreshToken || "";
    if (!refreshToken) throw new Error("Missing refresh_token from Google");
    this.db
      .query(
        `INSERT INTO gmail_accounts
          (id, email, access_token, refresh_token, scope, token_type, expiry_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           access_token = excluded.access_token,
           refresh_token = CASE
             WHEN excluded.refresh_token = '' THEN gmail_accounts.refresh_token
             ELSE excluded.refresh_token
           END,
           scope = excluded.scope,
           token_type = excluded.token_type,
           expiry_at = excluded.expiry_at,
           updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.email,
        input.accessToken,
        refreshToken,
        input.scope,
        input.tokenType,
        input.expiryAt,
        existing?.createdAt ?? now,
        now,
      );
    return this.getByEmail(input.email)!;
  }

  getByEmail(email: string): GmailAccount | undefined {
    const row = this.db
      .query(`SELECT * FROM gmail_accounts WHERE email = ?`)
      .get(email) as Row | null;
    return row ? rowToAccount(row) : undefined;
  }

  primary(): GmailAccount | undefined {
    const row = this.db
      .query(`SELECT * FROM gmail_accounts ORDER BY updated_at DESC LIMIT 1`)
      .get() as Row | null;
    return row ? rowToAccount(row) : undefined;
  }

  list(): GmailAccount[] {
    const rows = this.db
      .query(`SELECT * FROM gmail_accounts ORDER BY updated_at DESC`)
      .all() as Row[];
    return rows.map(rowToAccount);
  }

  delete(email: string): boolean {
    const result = this.db.query(`DELETE FROM gmail_accounts WHERE email = ?`).run(email);
    return result.changes > 0;
  }

  clear(): void {
    this.db.query(`DELETE FROM gmail_accounts`).run();
  }
}

let singleton: GmailStore | null = null;

export function getGmailStore(): GmailStore {
  if (!singleton) singleton = new GmailStore();
  return singleton;
}
