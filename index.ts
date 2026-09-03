import { AgentService } from "./src/services/agent.service";

const defaultPrompt = "Why is fast inference important?";
const prompt = process.argv.slice(2).join(" ") || defaultPrompt;

async function main() {
  try {
    const agent = new AgentService();
    const response = await agent.run({
      messages: [{ role: "user", content: prompt }],
    });

    console.log(`\n${response.content.trim()}\n`);

    if (response.toolCalls) {
      const calls = response.toolCalls
        .map((call) => `${call.name}(${call.arguments})`)
        .join(", ");
      console.log(`Tools used: ${calls}\n`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`\nFailed to run the agent: ${reason}\n`);
    process.exitCode = 1;
  }
}

main();
