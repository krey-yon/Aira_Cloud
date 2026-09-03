import type { ModelMessage } from "ai";

export type Message = ModelMessage;

export type AgentRequest = {
  messages: Message[];
  skillId?: string;
};

export type ToolCall = {
  name: string;
  arguments: string;
  result: unknown;
};

export type AgentResponse = {
  content: string;
  skillId: string;
  toolCalls?: ToolCall[];
};
