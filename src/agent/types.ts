import type { ModelMessage } from "ai";

export type Message = ModelMessage;

export type AgentRequest = {
  messages: Message[];
  skillId?: string;
};

export type AgentResponse = {
  content: string;
  skillId: string;
  skillIds?: string[];
  plan?: string;
  artifacts?: Array<{ key: string; value: unknown }>;
  toolCalls?: Array<{
    name: string;
    arguments: string;
    result: unknown;
  }>;
};
