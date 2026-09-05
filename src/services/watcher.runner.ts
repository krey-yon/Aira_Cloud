import type { ClientRegistry } from "./client.registry";
import { getLogRing } from "./log.ring";
import { getNotifyQueue } from "./notify.queue";
import { sendWatcherEmail } from "./resend.mail";
import { describeCondition, evalCondition } from "./watcher.condition";
import { getWatcherStore, type WatcherRecord } from "./watcher.store";

/**
 * Presence-aware delivery:
 * - If extension is online (recent heartbeat), send widget + email.
 * - If offline (Mac asleep / extension gone), keep the event pending — no email spam.
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

  /** Called when an extension heartbeat arrives. */
  async onClientPresent(clientId: string) {
    await this.flushQueue(clientId);
  }

  private async checkOne(watcher: WatcherRecord) {
    const now = Date.now();
    const nextCheckAt = now + watcher.intervalMinutes * 60_000;
    try {
      const response = await fetch(watcher.resourceUrl, {
        method: "GET",
        headers: { Accept: "application/json,text/plain,*/*" },
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
      }

      let json: unknown = text;
      try {
        json = JSON.parse(text);
      } catch {
        // plain text — condition path still can use eq on root via empty path tricks; keep string
        json = { value: text.trim() };
      }

      const { ok, observed } = evalCondition(json, {
        path: watcher.conditionPath,
        op: watcher.conditionOp,
        value: watcher.conditionValue,
      });
      const observedStr =
        typeof observed === "string" ? observed : JSON.stringify(observed);

      this.watchers.update(watcher.id, {
        nextCheckAt,
        lastCheckedAt: now,
        lastValue: observedStr?.slice(0, 500),
        lastError: undefined,
      });

      this.logs.append({
        kind: "job",
        level: "info",
        title: `watcher:${watcher.title}`,
        body: ok
          ? `Condition met (${describeCondition({
              path: watcher.conditionPath,
              op: watcher.conditionOp,
              value: watcher.conditionValue,
            })})`
          : `Checked — not yet (${String(observedStr).slice(0, 120)})`,
        clientId: watcher.clientId,
        source: "watcher",
      });

      if (!ok) return;

      // Fire once until user re-arms (status → active again).
      this.watchers.update(watcher.id, {
        status: "fired",
        lastFiredAt: now,
        lastNudge: `Condition met: ${observedStr?.slice(0, 180) || "true"}`,
        nextCheckAt: nextCheckAt,
      });

      this.queue.enqueue({
        title: watcher.title,
        body: [
          watcher.prompt,
          "",
          `Resource: ${watcher.resourceUrl}`,
          `Condition: ${describeCondition({
            path: watcher.conditionPath,
            op: watcher.conditionOp,
            value: watcher.conditionValue,
          })}`,
          `Observed: ${observedStr ?? "(empty)"}`,
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

      if (!online) {
        // Mac / extension offline — hold the event; do not email yet.
        continue;
      }

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

      if ((watcher?.notifyWidget ?? true) && !widgetSent && event.clientId) {
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

      const delivered = emailSent || widgetSent;
      this.queue.update(event.id, {
        emailSent,
        widgetSent,
        status: delivered ? "delivered" : error ? "failed" : "pending",
        deliveredAt: delivered ? Date.now() : undefined,
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
