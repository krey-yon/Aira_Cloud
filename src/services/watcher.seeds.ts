import type { WatchCondition } from "./watcher.condition";
import { getWatcherStore } from "./watcher.store";

/** Stable id so restarts update instead of duplicating. */
export const SOLANA_INDIA_GRANTS_WATCHER_ID = "watch_solana_india_grants";

const GRANT_PAGE =
  "https://superteam.fun/earn/grants/solana-foundation-india-grants";

/**
 * Prefer the HTML grant page (parses __NEXT_DATA__) so we survive Next.js build-id churn.
 * Conditions: fire when the grant is live — isPaused=false AND isArchived=false.
 */
export const SOLANA_INDIA_GRANTS_CONDITIONS: WatchCondition[] = [
  { path: "pageProps.grant.isPaused", op: "eq", value: "false" },
  { path: "pageProps.grant.isArchived", op: "eq", value: "false" },
];

export function ensureSolanaIndiaGrantsWatcher() {
  return getWatcherStore().ensure({
    id: SOLANA_INDIA_GRANTS_WATCHER_ID,
    title: "Solana Foundation India Grants",
    resourceUrl: GRANT_PAGE,
    conditions: SOLANA_INDIA_GRANTS_CONDITIONS,
    intervalMinutes: 6 * 60,
    notifyEmail: true,
    notifyWidget: true,
    prompt:
      "Alert when the Solana Foundation India Grants listing is open (isPaused=false and isArchived=false).",
  });
}
