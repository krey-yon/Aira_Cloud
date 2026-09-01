import { createGoogle } from "@ai-sdk/google";
import { generateText, isStepCount, type ToolSet } from "ai";

import { assertConfig, config } from "../config";
import type { Message } from "../types";

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
  }) {
    return generateText({
      model: this.model(),
      instructions: params.instructions,
      messages: params.messages,
      tools: params.tools,
      stopWhen: isStepCount(5),
    });
  }
}
