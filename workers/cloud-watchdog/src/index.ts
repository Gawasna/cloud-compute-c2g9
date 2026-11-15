import { sendTelegramAlert, type TelegramAlertPayload } from "./notifier.ts";
import { handleTelegramCommand, type TelegramUpdate } from "./commands.ts";

export interface Env {
  DEFAULT_HEALTH_ENDPOINT: string;
  HEALTH_ENDPOINT?: string;
  ALERT_SERVICE_NAME?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
}

export interface ProbeResult {
  ok: boolean;
  statusCode?: number;
  dbStatus?: string;
  overallStatus?: string;
  durationMs: number;
  error?: string;
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

    const dbStatus = (parsedBody.database as { status?: string } | undefined)?.status;
    const overallStatus = parsedBody.status as string | undefined;

    const isHealthy = res.status === 200 && dbStatus === "connected";

    return {
      ok: isHealthy,
      statusCode: res.status,
      dbStatus,
      overallStatus,
      durationMs,
      error: isHealthy ? undefined : `HTTP ${res.status}, DB: ${dbStatus || "disconnected"}`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      durationMs: Date.now() - start,
      error: errorMsg,
    };
  }
}

/**
 * Executes the watchdog heartbeat probe cycle.
 * Incorporates a 1-time retry delay of 2 seconds if the first attempt fails,
 * absorbing temporary Vercel serverless cold starts.
 */
export async function handleWatchdogPulse(env: Env): Promise<ProbeResult> {
  const target = env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT;
  console.log(`[Watchdog] Initiating health probe to: ${target}`);

  // Probe attempt 1
  let result = await executeProbe(target);

  // If first attempt fails, delay 2 seconds to absorb serverless cold start
  if (!result.ok) {
    console.warn(`[Watchdog] Attempt 1 failed (${result.error}). Retrying in 2s...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    result = await executeProbe(target);
  }

  if (result.ok) {
    console.log(`[Watchdog] Health pulse verified OK in ${result.durationMs}ms. DB status: ${result.dbStatus}`);
  } else {
    console.error(`[Watchdog] Health pulse permanently failed after retry: ${result.error}`);
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
      const payload: TelegramAlertPayload = {
        service: env.ALERT_SERVICE_NAME || "Cloud Compute Prod",
        url: target,
        statusCode: result.statusCode,
        error: result.error,
        dbStatus: result.dbStatus,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      };
      await sendTelegramAlert(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, payload);
    } else {
      console.warn("[Watchdog] Telegram credentials not configured. Skipping alert dispatch.");
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

    // 1. Telegram Webhook Handler for Slash Commands
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

    // 2. Manual on-demand probe trigger
    if (url.pathname === "/trigger") {
      const result = await handleWatchdogPulse(env);
      return new Response(JSON.stringify(result, null, 2), {
        status: result.ok ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Worker Health / Info Snapshot
    return new Response(
      JSON.stringify(
        {
          service: "Cloud Watchdog Edge Worker",
          status: "online",
          schedule: "*/10 * * * *",
          endpoints: ["/trigger", "/telegram-webhook"],
          target: env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT,
        },
        null,
        2
      ),
      { headers: { "Content-Type": "application/json" } }
    );
  },
};

export default worker;
