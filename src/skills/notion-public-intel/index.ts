import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const notionPublicIntelSkill: Skill = {
  id: "notion-public-intel",
  name: "Notion Public Intel",
  description:
    "Analyze what is publicly discoverable about a Notion page or share link: access posture, metadata, content outline, and last-updated 'X ago' timing. Use for public Notion URLs, notion.site pages, share-link research, or asking when a public Notion page was last updated. Not for private workspace edits.",
  instructions,
  maxSteps: 8,
};
