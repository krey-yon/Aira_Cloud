import { tool } from "ai";
import { z } from "zod";

import { askUser } from "../services/question.bridge";

export const askUserTool = tool({
  description:
    "Ask the human a multiple-choice question in the browser extension widget and wait for their reply. Use when you need a decision before continuing (scope, preference, yes/no, which option).",
  inputSchema: z.object({
    prompt: z.string().describe("Short question shown in the widget"),
    options: z
      .array(
        z.object({
          id: z.string().describe("Stable option id, e.g. a, b, yes"),
          label: z.string().describe("Button label the human sees"),
        }),
      )
      .min(2)
      .max(6),
  }),
  execute: async ({ prompt, options }) => {
    const reply = await askUser({ prompt, options });
    return {
      selectedId: reply.optionId,
      selectedLabel: reply.label,
    };
  },
});
