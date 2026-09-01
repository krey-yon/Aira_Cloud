import { getDefaultSkill, getSkill, getSkills } from "../skills";
import type { Skill } from "../skills/types";

export class SkillsService {
  list(): Skill[] {
    return getSkills();
  }

  resolve(skillId?: string): Skill {
    return skillId ? getSkill(skillId) : getDefaultSkill();
  }
}
