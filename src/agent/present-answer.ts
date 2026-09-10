import type { ServerToClientMessage, WidgetAction } from "../shared/agent";
import { previewWords, shouldUseCanvas } from "../shared/canvas";
import { actionsFromText, pickBodyFormat, presentBody } from "../shared/widget";
import { config, publicOrigin } from "../config";
import { getCanvasStore, type CanvasStore } from "../canvas/canvas.store";

export type PresentAnswerInput = {
  jobId: string;
  content: string;
  title?: string;
  notifyTitle?: string;
  wordCap?: number;
};

export type PresentedAnswer = {
  rawBody: string;
  widget: Extract<ServerToClientMessage, { type: "widget" }>;
  notify: Extract<ServerToClientMessage, { type: "notify" }>;
};

export type PresentErrorInput = {
  jobId: string;
  message: string;
  title?: string;
};

export function presentAnswer(
  input: PresentAnswerInput,
  canvases: CanvasStore = getCanvasStore(),
): PresentedAnswer {
  const title = input.title ?? "Aira";
  const rawBody = input.content.trim() || "Done.";
  const wordCap = input.wordCap ?? config.canvasWordCap;
  const useCanvas = shouldUseCanvas(rawBody, wordCap);
  const format = pickBodyFormat(rawBody, { canvas: useCanvas });
  let widgetBody = presentBody(rawBody, format);
  let canvasUrl: string | undefined;
  let actions: WidgetAction[] = actionsFromText(rawBody);

  if (useCanvas) {
    const record = canvases.put({ markdown: rawBody, title });
    canvasUrl = `${publicOrigin()}/r/${record.id}`;
    widgetBody = previewWords(rawBody);
    actions = [
      {
        id: "open_canvas",
        label: "Open full answer",
        kind: "link",
        url: canvasUrl,
        style: "primary",
      },
      ...actions.filter((a) => a.url !== canvasUrl),
    ];
  }

  return {
    rawBody,
    widget: {
      type: "widget",
      jobId: input.jobId,
      title,
      body: widgetBody.slice(0, 1600),
      kind: "answer",
      format,
      actions,
      ...(canvasUrl ? { canvasUrl } : {}),
    },
    notify: {
      type: "notify",
      jobId: input.jobId,
      title: input.notifyTitle ?? title,
      body: rawBody.slice(0, 180),
    },
  };
}

export function presentError(input: PresentErrorInput): {
  widget: Extract<ServerToClientMessage, { type: "widget" }>;
  notify: Extract<ServerToClientMessage, { type: "notify" }>;
} {
  const title = input.title ?? "Aira failed";
  const body = input.message.slice(0, 800);
  return {
    widget: {
      type: "widget",
      jobId: input.jobId,
      title,
      body,
      kind: "error",
      format: "plain",
      actions: [{ id: "dismiss", label: "Dismiss", kind: "dismiss", style: "secondary" }],
    },
    notify: {
      type: "notify",
      jobId: input.jobId,
      title,
      body: input.message.slice(0, 180),
    },
  };
}
