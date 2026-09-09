import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const gmailSkill: Skill = {
  id: "gmail",
  name: "Gmail",
  description:
    "Draft, schedule, and send email through the connected Gmail account, including templates and importance scores.",
  instructions,
  maxSteps: 12,
};
