import type { ClientRegistry } from "./client.registry";
import { getLogRing } from "./log.ring";
import { getNotifyQueue } from "./notify.queue";
import { sendWatcherEmail } from "./resend.mail";
import {
  describeCondition,
  evalAllConditions,
  normalizeWatchPayload,
} from "./watcher.condition";
import { conditionsFor, getWatcherStore, type WatcherRecord } from "./watcher.store";

async function fetchWatchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json,text/html,*/*",
      "User-Agent": "AiraWatcher/1.0",
    },
    signal: AbortSignal.timeout(25_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return normalizeWatchPayload(JSON.parse(trimmed));
  }

  const nextData = trimmed.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nextData?.[1]) {
    return normalizeWatchPayload(JSON.parse(nextData[1]));
  }

  throw new Error("Response was not JSON and no __NEXT_DATA__ was found.");
}

/**
 * Presence-aware widget delivery; email still sends so grant alerts aren't lost
 * while the Mac is asleep.
 */
export class WatcherRunner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private readonly watchers = getWatcherStore();
  private readonly queue = getNotifyQueue();
  private readonly logs = getLogRing();

  constructor(private readonly clients: ClientRegistry) {}

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
      const due = this.watchers.due();
      for (const watcher of due) {
        await this.checkOne(watcher);
      }
      await this.flushQueue();
    } finally {
      this.ticking = false;
    }
  }

  async onClientPresent(clientId: string) {
    await this.flushQueue(clientId);
  }

  private async checkOne(watcher: WatcherRecord) {
    const now = Date.now();
    const nextCheckAt = now + watcher.intervalMinutes * 60_000;
    try {
      const json = await fetchWatchJson(watcher.resourceUrl);
      const conditions = conditionsFor(watcher);
      const { ok, summary } = evalAllConditions(json, conditions);

      this.watchers.update(watcher.id, {
        nextCheckAt,
        lastCheckedAt: now,
        lastValue: summary.slice(0, 500),
        lastError: undefined,
        status: "active",
      });

      this.logs.append({
        kind: "job",
        level: "info",
        title: `watcher:${watcher.title}`,
        body: ok ? `Condition met (${summary})` : `Checked — waiting (${summary})`,
        clientId: watcher.clientId,
        source: "watcher",
      });

      if (!ok) return;

      this.watchers.update(watcher.id, {
        status: "fired",
        lastFiredAt: now,
        lastNudge: `Condition met: ${summary.slice(0, 180)}`,
        nextCheckAt,
        lastValue: summary.slice(0, 500),
      });

      this.queue.enqueue({
        title: watcher.title,
        body: [
          watcher.prompt,
          "",
          `Resource: ${watcher.resourceUrl}`,
          `Conditions: ${conditions.map(describeCondition).join(" AND ")}`,
          `Observed: ${summary}`,
        ]
          .filter(Boolean)
          .join("\n"),
        watcherId: watcher.id,
        clientId: watcher.clientId,
      });

      await this.flushQueue(watcher.clientId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.watchers.update(watcher.id, {
        nextCheckAt,
        lastCheckedAt: now,
        lastError: message.slice(0, 400),
        status: "error",
      });
      this.logs.append({
        kind: "error",
        level: "error",
        title: `watcher:${watcher.title}`,
        body: message.slice(0, 400),
        clientId: watcher.clientId,
        source: "watcher",
      });
    }
  }

  private async flushQueue(onlyClientId?: string) {
    const pending = this.queue.pending(30);
    for (const event of pending) {
      if (onlyClientId && event.clientId && event.clientId !== onlyClientId) continue;

      const online = event.clientId
        ? this.clients.isOnline(event.clientId)
        : this.clients.anyOnline();

      const watcher = event.watcherId ? this.watchers.get(event.watcherId) : undefined;
      let emailSent = event.emailSent;
      let widgetSent = event.widgetSent;
      let error: string | undefined;

      if ((watcher?.notifyEmail ?? true) && !emailSent) {
        const mail = await sendWatcherEmail({
          subject: `Aira · ${event.title}`,
          title: event.title,
          body: event.body,
          resourceUrl: watcher?.resourceUrl,
          observed: watcher?.lastValue,
        });
        if (mail.ok) emailSent = true;
        else error = mail.error;
      }

      if ((watcher?.notifyWidget ?? true) && !widgetSent && event.clientId && online) {
        this.clients.send(event.clientId, {
          type: "widget",
          jobId: event.watcherId,
          title: event.title,
          body: event.body.slice(0, 900),
          kind: "nudge",
          format: "plain",
          actions: watcher?.resourceUrl
            ? [
                {
                  id: "open_resource",
                  label: "Open resource",
                  kind: "link",
                  url: watcher.resourceUrl,
                  style: "primary",
                },
                { id: "dismiss", label: "Dismiss", kind: "dismiss", style: "secondary" },
              ]
            : [{ id: "dismiss", label: "Dismiss", kind: "dismiss", style: "secondary" }],
        });
        widgetSent = true;
      }

      const wantWidget = (watcher?.notifyWidget ?? true) && Boolean(event.clientId);
      const widgetSatisfied = !wantWidget || widgetSent || !online;
      const done = emailSent && widgetSatisfied;

      this.queue.update(event.id, {
        emailSent,
        widgetSent,
        status: done ? "delivered" : error && !emailSent ? "failed" : "pending",
        deliveredAt: done ? Date.now() : undefined,
        error,
      });
    }
  }
}

let runner: WatcherRunner | null = null;

export function getWatcherRunner(clients?: ClientRegistry): WatcherRunner {
  if (!runner) {
    if (!clients) throw new Error("WatcherRunner needs ClientRegistry on first bind");
    runner = new WatcherRunner(clients);
  }
  return runner;
}
