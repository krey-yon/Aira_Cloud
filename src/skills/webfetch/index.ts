import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const webfetchSkill: Skill = {
  id: "webfetch",
  name: "Web Fetch",
  description:
    "Fetch URL content as clean markdown via Exa. Use when the user gives a link to read, summarize, or analyze.",
  instructions,
  maxSteps: 6,
};
