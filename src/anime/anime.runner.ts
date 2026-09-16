import { getLogRing } from "../observability/log.ring";
import { applyFireSuccess, unitLabel } from "./anime.schedule";
import { sendAnimeEmail } from "./anime.mail";
import { getAnimeStore, type AnimeStore, type AnimeTracker } from "./anime.store";

export type AnimeMailer = (
  tracker: AnimeTracker,
) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>;

export class AnimeRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private readonly logs = getLogRing();

  constructor(
    private readonly store: AnimeStore = getAnimeStore(),
    private readonly mailer: AnimeMailer = sendAnimeEmail,
  ) {}

  start(intervalMs = 15_000) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    void this.tick();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const tracker of this.store.due()) {
        await this.fireOne(tracker);
      }
    } finally {
      this.ticking = false;
    }
  }

  private async fireOne(tracker: AnimeTracker) {
    const now = Date.now();
    try {
      const mail = await this.mailer(tracker);
      if (!mail.ok) {
        this.store.update(tracker.id, {
          lastError: mail.error.slice(0, 400),
          lastAttemptAt: now,
        });
        this.logs.append({
          kind: "error",
          level: "error",
          title: `anime:${tracker.title}`,
          body: mail.error.slice(0, 400),
          clientId: tracker.clientId,
          source: "anime",
        });
        return;
      }

      this.store.update(tracker.id, applyFireSuccess(tracker, now));
      const unit = unitLabel(tracker.kind);
      this.logs.append({
        kind: "job",
        level: "info",
        title: `anime:${tracker.title}`,
        body: `${unit} ${tracker.episode} emailed. Next ${unit.toLowerCase()} ${tracker.episode + 1}.`,
        clientId: tracker.clientId,
        source: "anime",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.store.update(tracker.id, {
        lastError: message.slice(0, 400),
        lastAttemptAt: now,
      });
      this.logs.append({
        kind: "error",
        level: "error",
        title: `anime:${tracker.title}`,
        body: message.slice(0, 400),
        clientId: tracker.clientId,
        source: "anime",
      });
    }
  }
}

let runner: AnimeRunner | null = null;

export function getAnimeRunner(): AnimeRunner {
  if (!runner) runner = new AnimeRunner();
  return runner;
}
