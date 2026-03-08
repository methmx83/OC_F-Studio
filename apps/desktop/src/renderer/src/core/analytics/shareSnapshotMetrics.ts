export type ShareSnapshotMetricEvent =
  | "share_snapshot_click"
  | "share_snapshot_success"
  | "share_snapshot_open_click"
  | "share_snapshot_open_success";

export interface ShareSnapshotMetrics {
  clicks: number;
  successes: number;
  openClicks: number;
  openSuccesses: number;
  lastClickedAt?: string;
  lastSucceededAt?: string;
  lastOpenClickedAt?: string;
  lastOpenSucceededAt?: string;
}

const SHARE_SNAPSHOT_METRICS_KEY = "ai-filmstudio.metrics.shareSnapshot.v1";

const DEFAULT_SHARE_SNAPSHOT_METRICS: ShareSnapshotMetrics = {
  clicks: 0,
  successes: 0,
  openClicks: 0,
  openSuccesses: 0,
};

export function readShareSnapshotMetrics(): ShareSnapshotMetrics {
  try {
    const raw = window.localStorage.getItem(SHARE_SNAPSHOT_METRICS_KEY);
    if (!raw) {
      return { ...DEFAULT_SHARE_SNAPSHOT_METRICS };
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SHARE_SNAPSHOT_METRICS };
    }

    const candidate = parsed as Partial<ShareSnapshotMetrics>;
    const clicks = Number.isFinite(candidate.clicks) ? Math.max(0, Number(candidate.clicks)) : 0;
    const successes = Number.isFinite(candidate.successes) ? Math.max(0, Number(candidate.successes)) : 0;
    const openClicks = Number.isFinite(candidate.openClicks) ? Math.max(0, Number(candidate.openClicks)) : 0;
    const openSuccesses = Number.isFinite(candidate.openSuccesses) ? Math.max(0, Number(candidate.openSuccesses)) : 0;
    const lastClickedAt = typeof candidate.lastClickedAt === "string" ? candidate.lastClickedAt : undefined;
    const lastSucceededAt = typeof candidate.lastSucceededAt === "string" ? candidate.lastSucceededAt : undefined;
    const lastOpenClickedAt = typeof candidate.lastOpenClickedAt === "string" ? candidate.lastOpenClickedAt : undefined;
    const lastOpenSucceededAt = typeof candidate.lastOpenSucceededAt === "string" ? candidate.lastOpenSucceededAt : undefined;
    return { clicks, successes, openClicks, openSuccesses, lastClickedAt, lastSucceededAt, lastOpenClickedAt, lastOpenSucceededAt };
  } catch {
    return { ...DEFAULT_SHARE_SNAPSHOT_METRICS };
  }
}

export function recordShareSnapshotMetric(eventName: ShareSnapshotMetricEvent): ShareSnapshotMetrics {
  const current = readShareSnapshotMetrics();
  const nowIso = new Date().toISOString();
  const next: ShareSnapshotMetrics = {
    ...current,
    clicks: eventName === "share_snapshot_click" ? current.clicks + 1 : current.clicks,
    successes: eventName === "share_snapshot_success" ? current.successes + 1 : current.successes,
    openClicks: eventName === "share_snapshot_open_click" ? current.openClicks + 1 : current.openClicks,
    openSuccesses: eventName === "share_snapshot_open_success" ? current.openSuccesses + 1 : current.openSuccesses,
    lastClickedAt: eventName === "share_snapshot_click" ? nowIso : current.lastClickedAt,
    lastSucceededAt: eventName === "share_snapshot_success" ? nowIso : current.lastSucceededAt,
    lastOpenClickedAt: eventName === "share_snapshot_open_click" ? nowIso : current.lastOpenClickedAt,
    lastOpenSucceededAt: eventName === "share_snapshot_open_success" ? nowIso : current.lastOpenSucceededAt,
  };

  try {
    window.localStorage.setItem(SHARE_SNAPSHOT_METRICS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }

  return next;
}
