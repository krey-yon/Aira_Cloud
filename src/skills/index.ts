import { getSkillStore } from "./skill.store";
import type { SkillRecord } from "./types";

export * from "./types";
export { getSkillStore, resetSkillStoreForTests, SkillStore } from "./skill.store";

export async function initSkills(): Promise<void> {
  await getSkillStore().ensureSeeded();
}

export function getSkills(): SkillRecord[] {
  return getSkillStore().listAll();
}

export function getSkill(id: string): SkillRecord {
  const skill = getSkillStore().get(id);
  if (!skill) {
    throw new Error(`Unknown skill: ${id}`);
  }
  return skill;
}

export function getDefaultSkill(): SkillRecord {
  return getSkill("general-assistant");
}

export function tryGetSkill(id: string): SkillRecord | null {
  return getSkillStore().get(id);
}
