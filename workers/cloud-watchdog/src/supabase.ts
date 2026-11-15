import { escapeHtml } from "./notifier.ts";
import { timingSafeEqualString } from "./dms.ts";

export interface SupabaseWebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE" | string;
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

export interface SupabaseLatencyState {
  consecutive_degraded: number;
  alerted_degraded: boolean;
  last_latency_ms: number;
  last_db_status?: string;
  last_updated: string;
}

export interface SupabaseLatencyAlertPayload {
  service: string;
  status: "degraded" | "recovered";
  latencyMs: number;
  dbStatus?: string;
  consecutiveDegraded: number;
  message: string;
}

export interface SupabaseLatencyResult {
  shouldAlert: boolean;
  isRecovery: boolean;
  state: SupabaseLatencyState;
  alertPayload?: SupabaseLatencyAlertPayload;
}

export const SUPABASE_LATENCY_STATE_KEY = "supabase:latency:state";

/**
 * Validates the Supabase webhook secret via x-supabase-token header or ?token= URL parameter.
 */
export function verifySupabaseSecret(
  request: Request,
  envSecret: string | undefined
): boolean {
  if (!envSecret || typeof envSecret !== "string" || envSecret.trim() === "") {
    return false;
  }

  // 1. Verify via x-supabase-token header
  const headerToken = request.headers.get("x-supabase-token");
  if (headerToken && timingSafeEqualString(headerToken, envSecret)) {
    return true;
  }

  // 2. Verify via URL search parameter ?token=...
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken && timingSafeEqualString(queryToken, envSecret)) {
      return true;
    }
  } catch {
    // Malformed request URL
  }

  return false;
}

export const SUPABASE_PROJECT_REF = "gsejxaasdujmqveshqyf";
export const SUPABASE_DASHBOARD_URL = `https://supabase.com/dashboard/project/${SUPABASE_PROJECT_REF}`;

/**
 * Formats a Supabase Database Webhook event into an HTML alert for Telegram.
 */
export function formatSupabaseWebhookAlert(payload: SupabaseWebhookPayload): string {
  const actionType = (payload.type || "UNKNOWN").toUpperCase();
  const schema = payload.schema || "public";
  const table = payload.table || "unknown";

  const lines: string[] = [
    `<b>[SUPABASE DB EVENT] ${escapeHtml(table.toUpperCase())}</b>`,
    ``,
    `<b>Action:</b> <code>${escapeHtml(actionType)}</code>`,
    `<b>Target:</b> <code>${escapeHtml(schema)}.${escapeHtml(table)}</code>`,
  ];

  if (payload.record && Object.keys(payload.record).length > 0) {
    const recordPreview = Object.entries(payload.record)
      .slice(0, 5)
      .map(([k, v]) => `  • <b>${escapeHtml(k)}:</b> <code>${escapeHtml(String(v))}</code>`)
      .join("\n");
    lines.push(`<b>Record Data:</b>\n${recordPreview}`);
  }

  if (payload.old_record && Object.keys(payload.old_record).length > 0 && actionType !== "INSERT") {
    const oldPreview = Object.entries(payload.old_record)
      .slice(0, 5)
      .map(([k, v]) => `  • <b>${escapeHtml(k)}:</b> <code>${escapeHtml(String(v))}</code>`)
      .join("\n");
    lines.push(`<b>Previous Data:</b>\n${oldPreview}`);
  }

  lines.push(``);
  lines.push(`🔗 <a href="${SUPABASE_DASHBOARD_URL}/editor">View in Supabase Table Editor</a>`);
  lines.push(``);
  lines.push(`<i>Dispatched by Cloudflare Edge Watchdog</i>`);

  return lines.join("\n");
}

/**
 * Evaluates Supabase database latency and health status.
 * Alerts if degraded (> thresholdMs or status != "connected") for 2 consecutive cycles.
 * Triggers recovery notice once latency returns to nominal baseline (< recoveryThresholdMs).
 */
export async function evaluateSupabaseLatency(
  latencyMs: number,
  dbStatus: string | undefined,
  kv?: { get: (k: string, t?: string) => Promise<string | null>; put: (k: string, v: string) => Promise<void> } | null,
  thresholdMs: number = 2500,
  recoveryThresholdMs: number = 1000
): Promise<SupabaseLatencyResult> {
  let state: SupabaseLatencyState = {
    consecutive_degraded: 0,
    alerted_degraded: false,
    last_latency_ms: latencyMs,
    last_db_status: dbStatus,
    last_updated: new Date().toISOString(),
  };

  if (kv) {
    try {
      const stored = await kv.get(SUPABASE_LATENCY_STATE_KEY, "json");
      if (stored) {
        state = stored as SupabaseLatencyState;
      }
    } catch {
      // KV fetch error fallback
    }
  }

  const isDegraded = (dbStatus !== undefined && dbStatus !== "connected") || latencyMs > thresholdMs;
  let shouldAlert = false;
  let isRecovery = false;
  let alertPayload: SupabaseLatencyAlertPayload | undefined;

  if (isDegraded) {
    state.consecutive_degraded = (state.consecutive_degraded || 0) + 1;
    if (state.consecutive_degraded >= 2 && !state.alerted_degraded) {
      state.alerted_degraded = true;
      shouldAlert = true;
      isRecovery = false;
      alertPayload = {
        service: "Supabase Postgres DB",
        status: "degraded",
        latencyMs,
        dbStatus: dbStatus || "unknown",
        consecutiveDegraded: state.consecutive_degraded,
        message: [
          `<b>[CRITICAL ALERT] Supabase DB Latency Degraded</b>`,
          ``,
          `<b>DB Status:</b> <code>${escapeHtml(dbStatus || "disconnected")}</code>`,
          `<b>Latency:</b> <code>${latencyMs}ms</code> (Threshold: ${thresholdMs}ms)`,
          `<b>Consecutive Failures:</b> <code>${state.consecutive_degraded}</code>`,
          `<b>Timestamp:</b> <code>${new Date().toISOString()}</code>`,
          ``,
          `<i>Database response time exceeded acceptable threshold across 2 consecutive cycles.</i>`,
        ].join("\n"),
      };
    }
  } else {
    const isHealthy = (dbStatus === "connected" || dbStatus === undefined) && latencyMs < recoveryThresholdMs;
    if (state.alerted_degraded && isHealthy) {
      state.alerted_degraded = false;
      state.consecutive_degraded = 0;
      shouldAlert = true;
      isRecovery = true;
      alertPayload = {
        service: "Supabase Postgres DB",
        status: "recovered",
        latencyMs,
        dbStatus: dbStatus || "connected",
        consecutiveDegraded: 0,
        message: [
          `<b>[RECOVERED] Supabase DB Latency Normalized</b>`,
          ``,
          `<b>DB Status:</b> <code>${escapeHtml(dbStatus || "connected")}</code>`,
          `<b>Latency:</b> <code>${latencyMs}ms</code> (Nominal baseline: &lt; ${recoveryThresholdMs}ms)`,
          `<b>Timestamp:</b> <code>${new Date().toISOString()}</code>`,
          ``,
          `<i>Database performance and connectivity have been fully restored.</i>`,
        ].join("\n"),
      };
    } else if (!state.alerted_degraded) {
      state.consecutive_degraded = 0;
    }
  }

  state.last_latency_ms = latencyMs;
  state.last_db_status = dbStatus;
  state.last_updated = new Date().toISOString();

  if (kv) {
    try {
      await kv.put(SUPABASE_LATENCY_STATE_KEY, JSON.stringify(state));
    } catch {
      // KV put error fallback
    }
  }

  return {
    shouldAlert,
    isRecovery,
    state,
    alertPayload,
  };
}

/**
 * Request handler for POST /api/supabase/webhook.
 */
export async function handleSupabaseWebhook(
  request: Request,
  env: Record<string, unknown>
): Promise<Response> {
  const secret = (env.SUPABASE_WEBHOOK_SECRET || env.SUPABASE_SECRET_TOKEN) as string | undefined;
  if (!verifySupabaseSecret(request, secret)) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: invalid secret token" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Bad Request: invalid JSON payload" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const alertHtml = formatSupabaseWebhookAlert(payload);

  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (botToken && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: alertHtml,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
    } catch (err: unknown) {
      console.error("[Supabase Webhook] Failed to dispatch Telegram alert:", err);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Webhook processed",
      table: payload.table,
      action: payload.type,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
