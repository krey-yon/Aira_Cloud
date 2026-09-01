import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const generalAssistantSkill: Skill = {
  id: "general-assistant",
  name: "General Assistant",
  description: "Default helpful assistant for general questions and tasks.",
  instructions,
};
