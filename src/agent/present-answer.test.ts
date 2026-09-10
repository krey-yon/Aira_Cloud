import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CanvasStore } from "../canvas/canvas.store";
import { presentAnswer, presentError } from "./present-answer";

function withCanvasStore(run: (store: CanvasStore) => void) {
  const dir = mkdtempSync(join(tmpdir(), "aira-present-"));
  const store = new CanvasStore(join(dir, "canvas.sqlite"));
  try {
    run(store);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("presentAnswer keeps short answers inline", () => {
  withCanvasStore((store) => {
    const presented = presentAnswer(
      { jobId: "job_1", content: "Hello world", title: "Aira" },
      store,
    );
    expect(presented.widget.kind).toBe("answer");
    expect(presented.widget.canvasUrl).toBeUndefined();
    expect(presented.widget.body).toContain("Hello");
    expect(presented.notify.body).toBe("Hello world");
  });
});

test("presentAnswer routes long answers to canvas", () => {
  withCanvasStore((store) => {
    const long = Array.from({ length: 200 }, (_, i) => `word${i}`).join(" ");
    const presented = presentAnswer(
      { jobId: "job_2", content: long, title: "Long", wordCap: 10 },
      store,
    );
    expect(presented.widget.canvasUrl).toMatch(/\/r\//);
    expect(presented.widget.actions?.[0]?.id).toBe("open_canvas");
    expect(presented.widget.body.endsWith("…")).toBe(true);
  });
});

test("presentError includes dismiss action", () => {
  const failed = presentError({ jobId: "job_3", message: "boom" });
  expect(failed.widget.kind).toBe("error");
  expect(failed.widget.actions?.[0]?.id).toBe("dismiss");
  expect(failed.notify.title).toBe("Aira failed");
});
