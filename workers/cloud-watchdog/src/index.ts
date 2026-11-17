import {
  sendTelegramAlert,
  sendTelegramWarning,
  sendTelegramDmsAlert,
  sendTelegramDmsRecovery,
  type TelegramAlertPayload,
} from "./notifier.ts";
import { handleTelegramCommand, type TelegramUpdate } from "./commands.ts";
import {
  verifyDmsToken,
  recordCheckin,
  appendTelemetryPoint,
  evaluateDmsTimeout,
  DMS_STATE_KEY,
  type DmsCheckinPayload,
} from "./dms.ts";
import { handleSentryWebhook } from "./sentry.ts";
import { handleSupabaseWebhook, evaluateSupabaseLatency } from "./supabase.ts";
import { evaluateBugsinkSpike, formatBugsinkSpikeAlert } from "./bugsink.ts";

export interface Env {
  DEFAULT_HEALTH_ENDPOINT: string;
  HEALTH_ENDPOINT?: string;
  ALERT_SERVICE_NAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  DMS_SECRET_TOKEN?: string;
  DMS_GRACE_PERIOD_SEC?: string;
  SENTRY_WEBHOOK_SECRET?: string;
  SUPABASE_WEBHOOK_SECRET?: string;
  BUGSINK_SPIKE_THRESHOLD?: string;
  WATCHDOG_KV?: KVNamespace;
  [key: string]: unknown;
}

export interface ProbeResult {
  ok: boolean;
  statusCode?: number;
  dbStatus?: string;
  dbLatencyMs?: number;
  overallStatus?: string;
  durationMs: number;
  error?: string;
}

/**
 * Checks whether the watchdog alert notifications are temporarily silenced via KV.
 */
export async function isWatchdogSilenced(kv?: KVNamespace | null): Promise<boolean> {
  if (!kv) return false;
  try {
    const val = await kv.get("watchdog:silence:active");
    return val !== null && val !== undefined;
  } catch {
    return false;
  }
}

/**
 * Performs a single HTTP GET probe to the health endpoint.
 */
export async function executeProbe(targetUrl: string, timeoutMs = 8000): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "Cloudflare-Worker-Cloud-Watchdog/1.0",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    const durationMs = Date.now() - start;
    const bodyText = await res.text();
    let parsedBody: Record<string, unknown> = {};

    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      // Body is not JSON
    }

    const dbObj = parsedBody.database as { status?: string; latency_ms?: number } | undefined;
    const dbStatus = dbObj?.status;
    const dbLatencyMs = typeof dbObj?.latency_ms === "number" ? dbObj.latency_ms : undefined;
    const overallStatus = parsedBody.status as string | undefined;

    const isHealthy = res.status === 200 && dbStatus === "connected";

    return {
      ok: isHealthy,
      statusCode: res.status,
      dbStatus,
      dbLatencyMs,
      overallStatus,
      durationMs,
      error: isHealthy ? undefined : `HTTP ${res.status}, DB: ${dbStatus || "disconnected"}`,
    };
  } catch {
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: "Health probe connection failed",
    };
  }
}

/**
 * Executes the watchdog heartbeat probe cycle (runs every 10 min).
 * 1. Probes Vercel + Supabase health with 1-time retry for cold starts.
 * 2. Saves cloud latency observation into the Telemetry Ring Buffer.
 * 3. Evaluates Dead Man's Switch on-premise node timeout and alerts if silent > grace period.
 */
export async function handleWatchdogPulse(env: Env): Promise<ProbeResult> {
  const target = env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT;
  console.log(`[Watchdog] Initiating health probe to: ${target}`);

  // 1. Probe attempt 1
  let result = await executeProbe(target);

  // If first attempt fails, delay 2 seconds to absorb serverless cold start
  if (!result.ok) {
    console.warn(`[Watchdog] Attempt 1 failed (${result.error}). Retrying in 2s...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = await executeProbe(target);
  }

  // 2. Telemetry and Alerting for Cloud Layer
  if (result.ok) {
    console.log(`[Watchdog] Health pulse verified OK in ${result.durationMs}ms. DB status: ${result.dbStatus}`);
  } else {
    console.error(`[Watchdog] Health pulse permanently failed after retry: ${result.error}`);
    const isSilenced = await isWatchdogSilenced(env.WATCHDOG_KV);
    if (isSilenced) {
      console.log("[Watchdog] Alert suppressed: silence mode is active");
    } else if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const payload: TelegramAlertPayload = {
        service: env.ALERT_SERVICE_NAME || "Cloud Compute Prod",
        url: target,
        statusCode: result.statusCode,
        error: result.error,
        dbStatus: result.dbStatus,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      };
      if (result.statusCode === 200 && result.dbStatus !== "connected") {
        await sendTelegramWarning(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, payload);
      } else {
        await sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, payload);
      }
    } else {
      console.warn("[Watchdog] Telegram credentials not configured. Skipping alert dispatch.");
    }
  }

  // 3. Persist Cloud Telemetry Point into Ring Buffer
  if (env.WATCHDOG_KV) {
    await appendTelemetryPoint(env.WATCHDOG_KV, {
      cloud_ok: result.ok,
      cloud_duration_ms: result.durationMs,
      db_status: result.dbStatus,
      db_latency_ms: result.dbLatencyMs,
    });

    // 4. Evaluate Dead Man's Switch for On-Premise Node
    const graceSec = parseInt(env.DMS_GRACE_PERIOD_SEC || "1200", 10);
    const dmsCheck = await evaluateDmsTimeout(env.WATCHDOG_KV, graceSec);

    if (dmsCheck.shouldAlert && dmsCheck.state && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const isSilenced = await isWatchdogSilenced(env.WATCHDOG_KV);
      if (isSilenced) {
        console.log("[DMS] Alert suppressed: silence mode is active");
      } else {
        console.warn(`[DMS] Triggering Dead Man's Switch alert! Node ${dmsCheck.state.node} silent for ${dmsCheck.diffSec}s`);
        await sendTelegramDmsAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
          node: dmsCheck.state.node,
          diffSec: dmsCheck.diffSec,
          gracePeriodSec: graceSec,
          lastSeenIso: new Date(dmsCheck.state.last_seen_epoch).toISOString(),
        });
      }
    } else if (dmsCheck.state && !dmsCheck.silent && dmsCheck.state.alerted_down) {
      console.log(`[DMS] Cloud-side recovery detected for node: ${dmsCheck.state.node}`);
      dmsCheck.state.alerted_down = false;
      await env.WATCHDOG_KV.put(DMS_STATE_KEY, JSON.stringify(dmsCheck.state));
      if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        await sendTelegramDmsRecovery(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
          node: dmsCheck.state.node,
          uptimeKuma: dmsCheck.state.uptime_kuma,
          loadAvg: dmsCheck.state.load_avg,
        });
      }
    }

    // 5. Evaluate Supabase Latency Degradation & Recovery
    if (result.dbLatencyMs !== undefined) {
      const latencyCheck = await evaluateSupabaseLatency(
        result.dbLatencyMs,
        result.dbStatus,
        env.WATCHDOG_KV
      );
      if (latencyCheck.shouldAlert && latencyCheck.alertPayload && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
        const isRecovery = latencyCheck.isRecovery;
        const isSilenced = await isWatchdogSilenced(env.WATCHDOG_KV);
        if (!isRecovery && isSilenced) {
          console.log("[Supabase] Latency alert suppressed: silence mode is active");
        } else {
          const msg = isRecovery
            ? `<b>[SUPABASE RECOVERED]</b> Độ trễ Database đã phục hồi về mức danh định!\n• Độ trễ: <code>${result.dbLatencyMs}ms</code>\n• Trạng thái: <code>${result.dbStatus || "connected"}</code>`
            : `<b>[WARNING ALERT] Phát Hiện Suy Giảm Hiệu Năng Supabase DB!</b>\n• Độ trễ hiện tại: <code>${result.dbLatencyMs}ms</code> (vượt ngưỡng 2500ms)\n• Trạng thái: <code>${result.dbStatus || "disconnected"}</code>\n• Số chu kỳ suy giảm: <code>${latencyCheck.state.consecutive_degraded}</code>\n\n💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`;

          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: msg,
              parse_mode: "HTML",
              disable_notification: isRecovery ? true : false,
            }),
          }).catch((err) => console.error("[Watchdog] Failed to dispatch Supabase latency alert:", err));
        }
      }
    }
  }

  return result;
}

const worker = {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleWatchdogPulse(env));
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Dead Man's Switch Check-in (Inverted Heartbeat from HP EliteDesk Node)
    if (url.pathname === "/api/dms/checkin" && request.method === "POST") {
      if (!env.DMS_SECRET_TOKEN || typeof env.DMS_SECRET_TOKEN !== "string" || env.DMS_SECRET_TOKEN.trim() === "") {
        console.error("[DMS] DMS_SECRET_TOKEN is not configured or empty");
        return new Response(JSON.stringify({ error: "Service Unavailable: auth not configured" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authHeader = request.headers.get("authorization");
      const authorized = await verifyDmsToken(authHeader, env.DMS_SECRET_TOKEN);
      if (!authorized) {
        console.warn("[DMS] Unauthorized check-in attempt: invalid token");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!env.WATCHDOG_KV) {
        console.error("[DMS] KV Namespace WATCHDOG_KV is not bound");
        return new Response(JSON.stringify({ error: "Storage Unavailable" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      try {
        const payload = (await request.json()) as DmsCheckinPayload;
        if (!payload.node) {
          return new Response(JSON.stringify({ error: "Missing node identifier" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { state, wasRecovered } = await recordCheckin(env.WATCHDOG_KV, payload);
        console.log(`[DMS] Heartbeat acknowledged from node: ${payload.node} (wasRecovered: ${wasRecovered})`);

        // If node was marked as down and now recovered, dispatch notice to Telegram
        if (wasRecovered && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          if (ctx && typeof ctx.waitUntil === "function") {
            ctx.waitUntil(
              sendTelegramDmsRecovery(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
                node: payload.node,
                uptimeKuma: payload.uptime_kuma,
                loadAvg: payload.load_avg,
              })
            );
          } else {
            await sendTelegramDmsRecovery(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, {
              node: payload.node,
              uptimeKuma: payload.uptime_kuma,
              loadAvg: payload.load_avg,
            });
          }
        }

        // Evaluate BugSink Anomaly Spike
        if (payload.bugsink && env.WATCHDOG_KV) {
          const spikeThreshold = parseInt(env.BUGSINK_SPIKE_THRESHOLD || "15", 10);
          const spikeCheck = await evaluateBugsinkSpike(payload.bugsink, env.WATCHDOG_KV, spikeThreshold);
          if (spikeCheck.isSpike && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
            const isSilenced = await isWatchdogSilenced(env.WATCHDOG_KV);
            if (isSilenced) {
              console.log("[BugSink] Spike alert suppressed: silence mode is active");
            } else {
              const alertText = formatBugsinkSpikeAlert(payload.bugsink, spikeCheck.delta);
              const sendAlert = fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: env.TELEGRAM_CHAT_ID,
                  text: alertText,
                  parse_mode: "HTML",
                  disable_web_page_preview: true,
                }),
              }).catch((err) => console.error("[DMS] Failed to dispatch BugSink spike alert:", err));

              if (ctx && typeof ctx.waitUntil === "function") {
                ctx.waitUntil(sendAlert);
              } else {
                await sendAlert;
              }
            }
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            node: state.node,
            last_seen_epoch: state.last_seen_epoch,
            was_recovered: wasRecovered,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } catch (err: unknown) {
        console.error("[DMS] Failed to process check-in payload:", err);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 2. Telegram Webhook Handler for Slash Commands
    if (url.pathname === "/telegram-webhook" && request.method === "POST") {
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token");
        if (incomingSecret !== env.TELEGRAM_WEBHOOK_SECRET) {
          console.warn("[Watchdog] Unauthorized webhook attempt: secret token mismatch");
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      try {
        const update = (await request.json()) as TelegramUpdate;
        if (ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(handleTelegramCommand(update, env));
        } else {
          await handleTelegramCommand(update, env);
        }
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err: unknown) {
        console.error("[Watchdog] Failed to process Telegram update payload:", err);
        return new Response(JSON.stringify({ ok: false, error: "Bad Request" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 3. Sentry Webhook Ingestion
    if (url.pathname === "/api/sentry-webhook" && request.method === "POST") {
      return handleSentryWebhook(request, env);
    }

    // 4. Supabase Database Webhook Ingestion
    if ((url.pathname === "/api/supabase-webhook" || url.pathname === "/api/supabase/webhook") && request.method === "POST") {
      return handleSupabaseWebhook(request, env, ctx);
    }

    // 5. Manual on-demand probe trigger
    if (url.pathname === "/trigger") {
      const result = await handleWatchdogPulse(env);
      const safeResponse = {
        ok: result.ok,
        statusCode: result.statusCode,
        dbStatus: result.dbStatus,
        dbLatencyMs: result.dbLatencyMs,
        durationMs: result.durationMs,
        status: result.ok ? "healthy" : "unhealthy",
      };
      return new Response(JSON.stringify(safeResponse, null, 2), {
        status: result.ok ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Worker Health / Info Snapshot
    return new Response(
      JSON.stringify(
        {
          service: "Cloud Watchdog Edge Worker",
          status: "online",
          schedule: "*/10 * * * *",
          endpoints: [
            "/trigger",
            "/telegram-webhook",
            "/api/dms/checkin",
            "/api/sentry-webhook",
            "/api/supabase-webhook",
          ],
          target: env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT,
          kv_bound: !!env.WATCHDOG_KV,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};

export default worker;
