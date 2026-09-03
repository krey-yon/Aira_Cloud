import { generalAssistantSkill } from "./general-assistant";
import type { Skill } from "./types";

export * from "./types";

const skills: Skill[] = [generalAssistantSkill];

export function getSkills(): Skill[] {
  return skills;
}

export function getSkill(id: string): Skill {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) {
    const available = getSkills()
      .map((entry) => entry.id)
      .join(", ");
    throw new Error(`Unknown skill: ${id}. Available skills: ${available}`);
  }
  return skill;
}

export function getDefaultSkill(): Skill {
  return generalAssistantSkill;
}
