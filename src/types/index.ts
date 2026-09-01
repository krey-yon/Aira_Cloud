import type { ModelMessage } from "ai";

export type Message = ModelMessage;

export type AgentRequest = {
  messages: Message[];
  skillId?: string;
};

export type AgentResponse = {
  content: string;
  skillId: string;
  toolCalls?: Array<{
    name: string;
    arguments: string;
    result: unknown;
  }>;
};
