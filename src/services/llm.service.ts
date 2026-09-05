import { createGoogle } from "@ai-sdk/google";
import { generateText, isStepCount, type ToolSet } from "ai";

import { assertConfig, config } from "../config";
import type { Message } from "../types";

export type StepToolEvent = {
  name: string;
  arguments: string;
  result: unknown;
};

export type GenerateHooks = {
  onTools?: (tools: StepToolEvent[]) => void;
};

export class LlmService {
  private readonly google;

  constructor() {
    assertConfig();
    this.google = createGoogle({ apiKey: config.apiKey });
  }

  model() {
    return this.google(config.defaultModel);
  }

  async generate(params: {
    instructions?: string;
    messages: Message[];
    tools?: ToolSet;
    maxSteps?: number;
    hooks?: GenerateHooks;
  }) {
    return generateText({
      model: this.model(),
      instructions: params.instructions,
      messages: params.messages,
      tools: params.tools,
      stopWhen: isStepCount(params.maxSteps ?? 5),
      onStepFinish: (step) => {
        const tools = (step.toolCalls ?? []).map((toolCall, index) => ({
          name: toolCall.toolName,
          arguments: JSON.stringify(toolCall.input ?? {}),
          result: step.toolResults?.[index]?.output,
        }));
        if (tools.length) params.hooks?.onTools?.(tools);
      },
    });
  }
}
