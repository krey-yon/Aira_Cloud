import { AgentService } from "./src/services/agent.service";

async function main() {
  const agent = new AgentService();
  const response = await agent.run({
    messages: [{ role: "user", content: "Why is fast inference important?" }],
  });

  console.log(response);
}

main();
