import { emailVerifySkill } from "./email-verify";
import { generalAssistantSkill } from "./general-assistant";
import { notionSkill } from "./notion";
import { webfetchSkill } from "./webfetch";
import { websearchSkill } from "./websearch";
import type { Skill } from "./types";

export * from "./types";

const skills: Skill[] = [
  generalAssistantSkill,
  notionSkill,
  emailVerifySkill,
  webfetchSkill,
  websearchSkill,
];

export function getSkills(): Skill[] {
  return skills;
}

export function getSkill(id: string): Skill {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) {
    throw new Error(`Unknown skill: ${id}`);
  }
  return skill;
}

export function getDefaultSkill(): Skill {
  return generalAssistantSkill;
}
