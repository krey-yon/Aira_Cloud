import type { AgentRequest, AgentResponse, ToolCall } from "../types";
import { LlmService } from "./llm.service";
import { SkillsService } from "./skills.service";
import { ToolsService } from "./tools.service";

// Structural slice of the SDK's step results so tool-call mapping stays testable
// without constructing the provider's full step types.
type StepWithTools = {
  toolCalls?: Array<{
    toolCallId?: string;
    toolName: string;
    input: unknown;
  }>;
  toolResults?: Array<{
    toolCallId?: string;
    output: unknown;
  }>;
};

// Tool call outputs are reported separately from the calls themselves
// (step.toolResults, keyed by toolCallId), so they must be joined back here.
export function extractToolCalls(steps: StepWithTools[]): ToolCall[] {
  return steps.flatMap((step) => {
    const resultsByCallId = new Map(
      (step.toolResults ?? []).map((result) => [
        result.toolCallId,
        result.output,
      ] as const),
    );

    return (step.toolCalls ?? []).map((toolCall) => ({
      name: toolCall.toolName,
      arguments: JSON.stringify(toolCall.input),
      result: toolCall.toolCallId
        ? resultsByCallId.get(toolCall.toolCallId)
        : undefined,
    }));
  });
}

export class AgentService {
  constructor(
    private readonly llm = new LlmService(),
    private readonly skills = new SkillsService(),
    private readonly tools = new ToolsService(),
  ) {}

  async run(request: AgentRequest): Promise<AgentResponse> {
    const skill = this.skills.resolve(request.skillId);

    const result = await this.llm.generate({
      instructions: skill.instructions,
      messages: request.messages,
      tools: this.tools.getToolSet(),
    });

    const toolCalls = extractToolCalls(result.steps);

    return {
      content: result.text,
      skillId: skill.id,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
