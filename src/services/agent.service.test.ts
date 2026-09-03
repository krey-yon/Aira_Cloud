import { expect, test } from "bun:test";

import { extractToolCalls } from "./agent.service";

test("extractToolCalls pairs each tool call with its result by id", () => {
  const calls = extractToolCalls([
    {
      toolCalls: [
        { toolCallId: "a", toolName: "echo", input: { message: "hi" } },
        { toolCallId: "b", toolName: "echo", input: { message: "bye" } },
      ],
      toolResults: [
        { toolCallId: "a", output: { echoed: "hi" } },
        { toolCallId: "b", output: { echoed: "bye" } },
      ],
    },
  ]);

  expect(calls).toEqual([
    { name: "echo", arguments: '{"message":"hi"}', result: { echoed: "hi" } },
    { name: "echo", arguments: '{"message":"bye"}', result: { echoed: "bye" } },
  ]);
});

test("extractToolCalls leaves result undefined for a call without a result", () => {
  const calls = extractToolCalls([
    {
      toolCalls: [{ toolCallId: "a", toolName: "echo", input: "ping" }],
      toolResults: [],
    },
  ]);

  expect(calls).toEqual([
    { name: "echo", arguments: '"ping"', result: undefined },
  ]);
});
