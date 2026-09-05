import { tool } from "ai";
import { z } from "zod";

import { askUser } from "../services/question.bridge";

export const askUserTool = tool({
  description:
    "Ask the human a clarifying question in the browser extension widget (OpenCode-style): option chips plus an optional free-text field. Wait for their reply before continuing. Use when you need a decision or missing detail.",
  inputSchema: z.object({
    prompt: z.string().describe("Short question shown in the widget"),
    options: z
      .array(
        z.object({
          id: z.string().describe("Stable option id, e.g. a, b, yes"),
          label: z.string().describe("Button label the human sees"),
        }),
      )
      .min(0)
      .max(6)
      .optional()
      .describe("Suggested choices; prefer 2–6 when possible"),
    allowFreeText: z
      .boolean()
      .optional()
      .describe("Show a free-text field (default true)"),
    placeholder: z
      .string()
      .optional()
      .describe("Placeholder for the free-text field"),
  }),
  execute: async ({ prompt, options, allowFreeText, placeholder }) => {
    const reply = await askUser({
      prompt,
      options,
      allowFreeText,
      placeholder,
    });
    return {
      selectedId: reply.optionId,
      selectedLabel: reply.label,
      text: reply.text,
    };
  },
});
