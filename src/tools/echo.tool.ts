import { tool } from "ai";
import { z } from "zod";

export const echoTool = tool({
  description: "Echo back the provided message.",
  inputSchema: z.object({
    message: z.string().describe("Text to echo back"),
  }),
  execute: async ({ message }) => ({
    echoed: message,
  }),
});
