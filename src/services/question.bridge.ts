import type { AgentQuestionOption } from "../shared/agent";
import { newQuestionId } from "../shared/agent";
import { getRequestContext } from "../lib/request-context";
import type { ClientRegistry } from "./client.registry";

export type QuestionReply = {
  optionId: string;
  label: string;
  text?: string;
};

type Pending = {
  resolve: (reply: QuestionReply) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  jobId: string;
  clientId: string;
};

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

let clients: ClientRegistry | null = null;
const pending = new Map<string, Pending>();

export function bindQuestionBridge(registry: ClientRegistry) {
  clients = registry;
}

export function resolveQuestionReply(input: {
  questionId: string;
  optionId?: string;
  label?: string;
  text?: string;
}): boolean {
  const entry = pending.get(input.questionId);
  if (!entry) return false;
  clearTimeout(entry.timer);
  pending.delete(input.questionId);

  const free = input.text?.trim();
  const optionId = (input.optionId || (free ? "free_text" : "")).trim();
  const label = (input.label?.trim() || free || optionId).trim();
  if (!optionId && !free) {
    entry.reject(new Error("Empty reply."));
    return true;
  }

  entry.resolve({
    optionId: optionId || "free_text",
    label,
    ...(free ? { text: free } : {}),
  });
  return true;
}

export async function askUser(input: {
  prompt: string;
  options?: AgentQuestionOption[];
  allowFreeText?: boolean;
  placeholder?: string;
  timeoutMs?: number;
}): Promise<QuestionReply> {
  const registry = clients;
  if (!registry) throw new Error("Question bridge is not bound.");

  const { clientId, jobId } = getRequestContext();
  if (!clientId || !jobId) {
    throw new Error("ask_user requires an active extension job.");
  }

  const options = (input.options ?? [])
    .map((option, index) => ({
      id: (option.id || `opt_${index + 1}`).trim(),
      label: option.label.trim(),
    }))
    .filter((option) => option.id && option.label);

  const allowFreeText = input.allowFreeText !== false;
  if (options.length < 2 && !allowFreeText) {
    throw new Error("ask_user needs at least two options, or allowFreeText.");
  }

  const questionId = newQuestionId();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const reply = new Promise<QuestionReply>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(questionId);
      reject(new Error("Timed out waiting for your answer."));
    }, timeoutMs);
    pending.set(questionId, { resolve, reject, timer, jobId, clientId });
  });

  registry.send(clientId, {
    type: "widget",
    jobId,
    title: "Aira needs a choice",
    body: input.prompt.trim(),
    kind: "question",
    format: "plain",
    questionId,
    options,
    allowFreeText,
    placeholder: input.placeholder?.trim() || "Or type your own answer…",
  });

  return reply;
}
