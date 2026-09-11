import { formatAgentClock } from "./agent-clock";
import { ArtifactBag } from "./artifacts";
import { planSkills } from "./planner";
import { getSkillStore, tryGetSkill } from "../skills";
import { getToolsFor } from "../tools";
import type { AgentRequest, AgentResponse } from "./types";
import { LlmService, type GenerateHooks } from "./llm.service";

const CORE_PREAMBLE = `# Who you are

You are Aira, the cloud agent behind the Aira browser extension and https://aira.kreyon.in.

# How to answer

- Short factual questions: plain prose. No markdown headings unless asked.
- Longer research: structured markdown is fine.
- When you create or find a URL, put the full https URL in your final message.
- After finishing, say what you did in one or two sentences and include links.
- Use tools when they complete the task. Prefer doing the work over narrating plans.
- Do not ask clarifying questions by default. Call ask_user only when truly blocked (at most 1–2 asks).
- Never write <ask_user> tags in your final answer — only call the ask_user tool.
`;

export class AgentService {
  constructor(private readonly llm = new LlmService()) {}

  async run(request: AgentRequest, hooks?: GenerateHooks): Promise<AgentResponse> {
    const store = getSkillStore();
    await store.ensureSeeded();
    const catalog = store.listMeta();

    const pinned =
      request.skillId && tryGetSkill(request.skillId) ? request.skillId : undefined;
    if (request.skillId && !pinned) {
      console.warn(`[planner] unknown skillId "${request.skillId}", ignoring pin`);
    }

    const userText = request.messages
      .filter((m) => m.role === "user")
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n");

    const planned = planSkills({
      text: userText,
      skillId: pinned,
      catalog,
    });

    const bodies = store.loadBodies(planned.skillIds);
    if (bodies.length === 0) {
      const fallback = store.get("general-assistant");
      if (!fallback) throw new Error("No skills available");
      bodies.push(fallback);
      planned.skillIds = [fallback.id];
    }

    const toolNames = [...new Set(bodies.flatMap((b) => b.tools))];
    const tools = getToolsFor(toolNames);

    const skillBlocks = bodies
      .map((b) => `# Skill: ${b.name} (${b.id})\n\n${b.instructions}`)
      .join("\n\n---\n\n");

    const artifacts = new ArtifactBag();
    const wrappedHooks: GenerateHooks = {
      onThinking: hooks?.onThinking,
      onTools: (events) => {
        for (const event of events) {
          artifacts.ingestToolResult(event.name, event.result);
        }
        hooks?.onTools?.(events);
      },
    };

    const instructions = [
      CORE_PREAMBLE,
      `# Plan\n${planned.plan}\nActive skills: ${planned.skillIds.join(", ")}`,
      skillBlocks,
      `# Current time\n${formatAgentClock()}\nUse this clock when building schedule_task runAt values. Prefer delayMinutes/delayHours for relative times.`,
      `# Artifact rule\nWhen a search or read returns a Notion page id/url, reuse that id for write/update. Do not create a new page when an existing match was found.`,
    ].join("\n\n");

    const result = await this.llm.generate({
      instructions,
      messages: request.messages,
      tools,
      maxSteps: planned.maxSteps,
      hooks: wrappedHooks,
    });

    const toolCalls = result.steps.flatMap((step) =>
      (step.toolCalls ?? []).map((toolCall) => ({
        name: toolCall.toolName,
        arguments: JSON.stringify(toolCall.input),
        result: toolCall.output,
      })),
    );

    return {
      content: result.text,
      skillId: planned.skillIds[0]!,
      skillIds: planned.skillIds,
      plan: planned.plan,
      artifacts: artifacts.entries(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
