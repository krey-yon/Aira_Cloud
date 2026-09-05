import type { Skill } from "../types";

const instructions = await Bun.file(
  new URL("./SKILL.md", import.meta.url),
).text();

export const emailVerifySkill: Skill = {
  id: "email-verify",
  name: "Email Verify",
  description:
    "Check whether an email address is deliverable: syntax check, DNS/MX lookup, catch-all detection, and SMTP recipient probing with plain-English interpretation. Use when the user asks if an email is valid, deliverable, reachable, or exists, or wants to confirm a contact/recruiter email before sending.",
  instructions,
};
