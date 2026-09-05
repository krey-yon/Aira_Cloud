import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const notionSkill: Skill = {
  id: "notion",
  name: "Notion",
  description:
    "Read, organize, and create well-styled Notion pages and databases through the Notion API.",
  instructions,
  maxSteps: 12,
};
