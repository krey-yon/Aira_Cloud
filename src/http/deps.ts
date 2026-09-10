import type { JobRunner } from "../agent/job.runner";
import type { JobStore } from "../agent/job.store";
import type { CanvasStore } from "../canvas/canvas.store";
import type { ErrorStore } from "../observability/error.store";
import type { LogRing } from "../observability/log.ring";
import type { ClientRegistry } from "../realtime/client.registry";
import type { SchedulerService } from "../scheduler/scheduler";
import type { NotifyQueue } from "../watchers/notify.queue";
import type { WatcherRunner } from "../watchers/watcher.runner";
import type { WatcherStore } from "../watchers/watcher.store";

export type AppDeps = {
  jobs: JobStore;
  clients: ClientRegistry;
  errors: ErrorStore;
  runner: JobRunner;
  scheduler: SchedulerService;
  logs: LogRing;
  watchers: WatcherStore;
  notifyQueue: NotifyQueue;
  watcherRunner: WatcherRunner;
  canvases: CanvasStore;
};
