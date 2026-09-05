import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const websearchSkill: Skill = {
  id: "websearch",
  name: "Web Search",
  description:
    "Search the live web with Exa for current events, recent data, and facts beyond knowledge cutoff.",
  instructions,
  maxSteps: 8,
};
