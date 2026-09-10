import { formatAgentClock } from "../lib/agent-clock";
import { getDefaultSkill, getSkill } from "../skills";
import { getTools } from "../tools";
import type { AgentRequest, AgentResponse } from "../types";
import { LlmService, type GenerateHooks } from "./llm.service";

export class AgentService {
  constructor(private readonly llm = new LlmService()) {}

  async run(request: AgentRequest, hooks?: GenerateHooks): Promise<AgentResponse> {
    const skill = request.skillId ? getSkill(request.skillId) : getDefaultSkill();

    const result = await this.llm.generate({
      instructions: `${skill.instructions}\n\n# Current time\n${formatAgentClock()}\nUse this clock when building schedule_task runAt values. Prefer delayMinutes/delayHours for relative times.`,
      messages: request.messages,
      tools: getTools(),
      maxSteps: skill.maxSteps,
      hooks,
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
      skillId: skill.id,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
