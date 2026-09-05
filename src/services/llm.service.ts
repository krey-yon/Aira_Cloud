import { generateText, isStepCount, type ToolSet } from "ai";
import { createWorkersAI } from "workers-ai-provider";

import { assertConfig, config } from "../config";
import type { Message } from "../types";

export type StepToolEvent = {
  name: string;
  arguments: string;
  result: unknown;
};

export type GenerateHooks = {
  onTools?: (tools: StepToolEvent[]) => void;
  /** Model reasoning / intermediate text between tool steps. */
  onThinking?: (text: string) => void;
};

export class LlmService {
  private workersai: ReturnType<typeof createWorkersAI> | null = null;

  private provider() {
    if (!this.workersai) {
      assertConfig();
      this.workersai = createWorkersAI({
        accountId: config.cloudflareAccountId,
        apiKey: config.cloudflareApiToken,
      });
    }
    return this.workersai;
  }

  model() {
    return this.provider()(config.defaultModel as `@cf/${string}`);
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
        const thinking =
          (typeof step.reasoningText === "string" && step.reasoningText.trim()) ||
          (typeof step.reasoning === "string" && step.reasoning.trim()) ||
          "";
        if (thinking) params.hooks?.onThinking?.(thinking.slice(0, 2000));

        // Intermediate model prose before / between tools (not the final answer alone).
        const stepText = typeof step.text === "string" ? step.text.trim() : "";
        if (stepText && (step.toolCalls?.length ?? 0) > 0) {
          params.hooks?.onThinking?.(stepText.slice(0, 2000));
        }

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
