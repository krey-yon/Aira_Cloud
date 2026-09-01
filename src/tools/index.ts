import { echoTool } from "./echo.tool";
import type { AppTools } from "./types";

export * from "./types";

export const tools = {
  echo: echoTool,
} satisfies AppTools;

export function getTools(): AppTools {
  return tools;
}
