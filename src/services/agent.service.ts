import type { AgentRequest, AgentResponse } from "../types";
import { LlmService } from "./llm.service";
import { SkillsService } from "./skills.service";
import { ToolsService } from "./tools.service";

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
      maxSteps: skill.maxSteps,
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
