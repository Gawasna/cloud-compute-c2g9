/**
 * ==============================================================================
 * Module: workers/cloud-watchdog/src/bugsink.ts
 * Purpose: BugSink self-hosted issue tracker telemetry parsing, anomaly spike
 *          detection, anti-flood suppression, and Telegram alert formatting.
 * Architecture: Edge Worker (Cloudflare Workers / V8 isolate)
 * Security: Strict HTML escaping, Tailnet-only URL exposure, no sensitive leak.
 * ==============================================================================
 */

export interface BugsinkRecentIssue {
  id: number;
  type: string;
  value: string;
}

export interface BugsinkTelemetry {
  status: "ok" | "unavailable" | string;
  total_issues?: number;
  total_events?: number;
  recent_issues?: BugsinkRecentIssue[];
  delta_events?: number;
}

export interface BugsinkSpikeEvaluation {
  isSpike: boolean;
  delta: number;
  suppressed?: boolean;
  reason?: string;
}

export const BUGSINK_SPIKE_ALERTED_KEY = "bugsink:spike:alerted";
export const BUGSINK_LAST_EVENTS_KEY = "bugsink:telemetry:last_events";
export const DEFAULT_BUGSINK_SPIKE_THRESHOLD = 15;
export const BUGSINK_ALERT_TTL_SEC = 1800; // 30 minutes anti-flood
export const BUGSINK_DASHBOARD_URL = "https://elitedesk-hp.ts.net:8443";

export interface SimpleKV {
  get: (key: string, type?: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
}

/**
 * Escapes HTML characters for safe Telegram message rendering.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Evaluates whether BugSink has experienced an anomalous surge in error events.
 * Uses KV to track previous baseline and enforce a 30-minute anti-flood cooldown.
 */
export async function evaluateBugsinkSpike(
  telemetry: BugsinkTelemetry | undefined | null,
  kv: SimpleKV,
  threshold: number = DEFAULT_BUGSINK_SPIKE_THRESHOLD
): Promise<BugsinkSpikeEvaluation> {
  if (!telemetry || telemetry.status !== "ok") {
    return {
      isSpike: false,
      delta: 0,
      reason: "telemetry_unavailable",
    };
  }

  let delta = 0;

  if (typeof telemetry.delta_events === "number") {
    delta = telemetry.delta_events;
    if (typeof telemetry.total_events === "number") {
      await kv.put(BUGSINK_LAST_EVENTS_KEY, String(telemetry.total_events));
    }
  } else if (typeof telemetry.total_events === "number") {
    const prevStr = await kv.get(BUGSINK_LAST_EVENTS_KEY);
    const currentTotal = telemetry.total_events;
    await kv.put(BUGSINK_LAST_EVENTS_KEY, String(currentTotal));

    if (prevStr !== null) {
      const prev = parseInt(prevStr, 10);
      if (!isNaN(prev) && currentTotal >= prev) {
        delta = currentTotal - prev;
      } else {
        delta = 0;
      }
    } else {
      // First baseline recorded, do not trigger a spike immediately
      delta = 0;
    }
  }

  if (delta >= threshold) {
    const alerted = await kv.get(BUGSINK_SPIKE_ALERTED_KEY);
    if (alerted) {
      return {
        isSpike: false,
        delta,
        suppressed: true,
        reason: "anti_flood_active",
      };
    }

    await kv.put(BUGSINK_SPIKE_ALERTED_KEY, "true", {
      expirationTtl: BUGSINK_ALERT_TTL_SEC,
    });

    return {
      isSpike: true,
      delta,
      suppressed: false,
    };
  }

  return {
    isSpike: false,
    delta,
    suppressed: false,
  };
}

/**
 * Formats a Telegram HTML alert message when an anomalous spike is confirmed.
 */
export function formatBugsinkSpikeAlert(
  telemetry: BugsinkTelemetry,
  delta?: number
): string {
  const deltaVal = delta !== undefined ? delta : (telemetry.delta_events ?? 0);
  const issuesDisplay = telemetry.total_issues !== undefined ? String(telemetry.total_issues) : "N/A";
  const eventsDisplay = telemetry.total_events !== undefined ? String(telemetry.total_events) : "N/A";

  const lines = [
    `<b>[WARNING ALERT] Phát Hiện Spike Lỗi Mới Trên BugSink!</b>`,
    ``,
    `<b>Trạng thái:</b> <code>Cảnh báo đột biến lỗi (Spike Detected)</code>`,
    `<b>Số lỗi mới phát sinh:</b> <code>${deltaVal}</code>`,
    `<b>Số issue chưa giải quyết:</b> <code>${issuesDisplay}</code>`,
    `<b>Tổng số sự kiện (Events):</b> <code>${eventsDisplay}</code>`,
  ];

  if (telemetry.recent_issues && telemetry.recent_issues.length > 0) {
    lines.push(``);
    lines.push(`<b>Sự cố gần nhất:</b>`);
    for (const issue of telemetry.recent_issues) {
      const typeStr = escapeHtml(issue.type || "Error");
      const valStr = escapeHtml(issue.value || "");
      lines.push(`• <code>[#${issue.id}] ${typeStr}</code>: ${valStr}`);
    }
  }

  lines.push(``);
  lines.push(`<b>Truy cập BugSink Dashboard (Tailnet-only):</b>`);
  lines.push(`<a href="${BUGSINK_DASHBOARD_URL}">${BUGSINK_DASHBOARD_URL}</a>`);
  lines.push(``);
  lines.push(`<i>Dispatched by Cloudflare Edge Watchdog</i>`);

  return lines.join("\n");
}

/**
 * Formats a single-line BugSink status summary suitable for the Telegram /status command.
 */
export function formatBugsinkSummary(
  telemetry: BugsinkTelemetry | undefined | null
): string {
  if (!telemetry || telemetry.status !== "ok") {
    return `• <b>Bugsink:</b> <code>Không khả dụng (N/A)</code>`;
  }

  const issues = telemetry.total_issues ?? 0;
  const events = telemetry.total_events ?? 0;
  return `• <b>Bugsink:</b> <code>${issues} issues | ${events} events</code>`;
}
