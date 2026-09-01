import { getTools } from "../tools";

export class ToolsService {
  getToolSet() {
    return getTools();
  }
}
