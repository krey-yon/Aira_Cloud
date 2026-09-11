import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { config } from "../config";
import { createSingleton, openSqlite } from "../persist/sqlite";
import { loadBundledSkillSeeds } from "./seed";
import type { SkillEdge, SkillMeta, SkillRecord } from "./types";

type SkillRow = {
  id: string;
  name: string;
  description: string;
  tags_json: string;
  instructions: string;
  tools_json: string;
  max_steps: number | null;
  edges_json: string;
  updated_at: number;
};

function parseJsonArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseEdges(raw: string): SkillEdge[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is SkillEdge => {
      if (!item || typeof item !== "object") return false;
      const edge = item as SkillEdge;
      return (
        typeof edge.to === "string" &&
        (edge.kind === "routes-to" || edge.kind === "compose-with")
      );
    });
  } catch {
    return [];
  }
}

function rowToRecord(row: SkillRow): SkillRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    tags: parseJsonArray(row.tags_json),
    instructions: row.instructions,
    tools: parseJsonArray(row.tools_json),
    maxSteps: row.max_steps ?? undefined,
    edges: parseEdges(row.edges_json),
    updatedAt: row.updated_at,
  };
}

function toMeta(record: SkillRecord): SkillMeta {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    tags: record.tags,
    tools: record.tools,
    maxSteps: record.maxSteps,
    edges: record.edges,
  };
}

const skillStore = createSingleton(() => new SkillStore(config.skillsDbPath));

export function getSkillStore(): SkillStore {
  return skillStore.get();
}

export function resetSkillStoreForTests(): void {
  skillStore.reset();
}

export class SkillStore {
  private readonly db: Database;
  private seeded = false;

  constructor(path: string) {
    this.db = openSqlite(path, { wal: false });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        instructions TEXT NOT NULL,
        tools_json TEXT NOT NULL,
        max_steps INTEGER,
        edges_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  async ensureSeeded(): Promise<void> {
    if (this.seeded) return;
    const count = (
      this.db.query(`SELECT COUNT(*) AS n FROM skills`).get() as { n: number }
    ).n;
    if (count === 0) {
      const packs = await loadBundledSkillSeeds();
      const insert = this.db.prepare(`
        INSERT INTO skills (
          id, name, description, tags_json, instructions, tools_json, max_steps, edges_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = this.db.transaction((rows: Omit<SkillRecord, "updatedAt">[]) => {
        const now = Date.now();
        for (const [i, pack] of rows.entries()) {
          insert.run(
            pack.id,
            pack.name,
            pack.description,
            JSON.stringify(pack.tags),
            pack.instructions,
            JSON.stringify(pack.tools),
            pack.maxSteps ?? null,
            JSON.stringify(pack.edges),
            now + i,
          );
        }
      });
      tx(packs);
    }
    this.seeded = true;
  }

  listMeta(): SkillMeta[] {
    const rows = this.db
      .query(
        `SELECT id, name, description, tags_json, instructions, tools_json, max_steps, edges_json, updated_at
         FROM skills ORDER BY name COLLATE NOCASE`,
      )
      .all() as SkillRow[];
    return rows.map((row) => toMeta(rowToRecord(row)));
  }

  listAll(): SkillRecord[] {
    const rows = this.db
      .query(
        `SELECT id, name, description, tags_json, instructions, tools_json, max_steps, edges_json, updated_at
         FROM skills ORDER BY name COLLATE NOCASE`,
      )
      .all() as SkillRow[];
    return rows.map(rowToRecord);
  }

  get(id: string): SkillRecord | null {
    const row = this.db
      .query(
        `SELECT id, name, description, tags_json, instructions, tools_json, max_steps, edges_json, updated_at
         FROM skills WHERE id = ?`,
      )
      .get(id) as SkillRow | null;
    return row ? rowToRecord(row) : null;
  }

  loadBodies(ids: string[]): SkillRecord[] {
    const out: SkillRecord[] = [];
    for (const id of ids) {
      const record = this.get(id);
      if (record) out.push(record);
    }
    return out;
  }

  upsert(input: {
    id: string;
    name: string;
    description: string;
    tags?: string[];
    instructions: string;
    tools: string[];
    maxSteps?: number;
    edges?: SkillEdge[];
  }): SkillRecord {
    const updatedAt = Date.now();
    this.db
      .query(
        `INSERT INTO skills (
          id, name, description, tags_json, instructions, tools_json, max_steps, edges_json, updated_at
        ) VALUES ($id, $name, $description, $tags, $instructions, $tools, $maxSteps, $edges, $updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          tags_json = excluded.tags_json,
          instructions = excluded.instructions,
          tools_json = excluded.tools_json,
          max_steps = excluded.max_steps,
          edges_json = excluded.edges_json,
          updated_at = excluded.updated_at`,
      )
      .run({
        $id: input.id,
        $name: input.name,
        $description: input.description,
        $tags: JSON.stringify(input.tags ?? []),
        $instructions: input.instructions,
        $tools: JSON.stringify(input.tools),
        $maxSteps: input.maxSteps ?? null,
        $edges: JSON.stringify(input.edges ?? []),
        $updatedAt: updatedAt,
      });
    return this.get(input.id)!;
  }

  delete(id: string): boolean {
    const result = this.db.query(`DELETE FROM skills WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  exportToDir(dir: string): string[] {
    mkdirSync(dir, { recursive: true });
    const paths: string[] = [];
    for (const skill of this.listAll()) {
      const path = join(dir, `${skill.id}.md`);
      const front = [
        "---",
        `name: ${skill.name}`,
        `description: ${JSON.stringify(skill.description)}`,
        `tags: ${JSON.stringify(skill.tags)}`,
        `tools: ${JSON.stringify(skill.tools)}`,
        skill.maxSteps != null ? `maxSteps: ${skill.maxSteps}` : null,
        "---",
        "",
        skill.instructions.replace(/^---[\s\S]*?---\s*/m, ""),
      ]
        .filter((line) => line != null)
        .join("\n");
      writeFileSync(path, front.endsWith("\n") ? front : `${front}\n`);
      paths.push(path);
    }
    return paths;
  }
}
