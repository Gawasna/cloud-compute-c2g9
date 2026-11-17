import { escapeHtml } from "./notifier.ts";

/**
 * Sentry Webhook Ingestion & Telegram Dispatcher Module
 * First Stream Webhook handler for Sentry issue & event alerts on Cloudflare Edge Worker.
 */

export interface SentryProject {
  id?: string | number;
  name?: string;
  slug?: string;
}

export interface SentryIssue {
  id: string | number;
  title?: string;
  culprit?: string;
  permalink?: string;
  shortId?: string;
  level?: string;
  status?: string;
  project?: SentryProject;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  [key: string]: unknown;
}

export interface SentryEvent {
  id?: string;
  event_id?: string;
  title?: string;
  message?: string;
  environment?: string;
  release?: string;
  level?: string;
  timestamp?: number | string;
  tags?: Array<[string, string]> | Record<string, string>;
  web_url?: string;
  url?: string;
  [key: string]: unknown;
}

export interface SentryWebhookPayload {
  action?: string;
  issue?: SentryIssue;
  event?: SentryEvent;
  project?: SentryProject;
  data?: {
    issue?: SentryIssue;
    event?: SentryEvent;
    project?: SentryProject;
    [key: string]: unknown;
  };
  id?: string | number;
  title?: string;
  culprit?: string;
  level?: string;
  url?: string;
  web_url?: string;
  [key: string]: unknown;
}

export interface SentryKV {
  get(key: string, type?: any): Promise<any>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete?(key: string): Promise<void>;
}

export interface SentryEnv {
  SENTRY_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  WATCHDOG_KV?: SentryKV;
  [key: string]: unknown;
}

export interface TelegramDispatchOptions {
  delaysMs?: number[];
  sleepFn?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
}

/**
 * Constant-time string equality check to mitigate timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verifies Sentry webhook secret via x-sentry-token header or ?token= URL query param.
 * Uses constant-time comparison to prevent timing attacks and avoid secret leakage.
 */
export function verifySentrySecret(request: Request, envSecret?: string): boolean {
  if (!envSecret || typeof envSecret !== "string" || envSecret.trim() === "") {
    return false;
  }

  // 1. Check HTTP Header 'x-sentry-token'
  const headerToken = request.headers.get("x-sentry-token");
  if (headerToken && timingSafeEqualString(headerToken, envSecret)) {
    return true;
  }

  // 2. Check URL search param '?token=...'
  try {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken && timingSafeEqualString(queryToken, envSecret)) {
      return true;
    }
  } catch {
    // Malformed URL
  }

  return false;
}

/**
 * Formats Sentry alert into clean, structured Telegram HTML with Deep Link.
 * Standardizes Project (CloudStock), Severity Level, Culprit, Environment, and Direct Issue Link.
 */
export function formatSentryAlert(payload: SentryWebhookPayload): string {
  const issue = payload.issue || payload.data?.issue;
  const event = payload.event || payload.data?.event;
  const project = payload.project || payload.data?.project || issue?.project;

  const title = issue?.title || event?.title || payload.title || "Sentry Error Event";
  const culprit = issue?.culprit || payload.culprit || event?.message || "Unknown culprit";
  const level = (event?.level || issue?.level || payload.level || "error").toUpperCase();
  const environment = event?.environment || "production";
  const release = event?.release || "N/A";
  const rawLink = issue?.permalink || event?.web_url || event?.url || payload.url || payload.web_url;

  let link = "https://gawasu.sentry.io/issues/?project=cloudstock";
  if (rawLink && (rawLink.startsWith("https://") || rawLink.startsWith("http://"))) {
    link = rawLink.includes("sentry.io/organizations/cloudstock")
      ? (issue?.id ? `https://gawasu.sentry.io/issues/?query=${encodeURIComponent(String(issue.id))}` : link)
      : rawLink;
  } else if (issue?.id) {
    link = `https://gawasu.sentry.io/issues/?query=${encodeURIComponent(String(issue.id))}`;
  }

  const projectName = project?.name || project?.slug || "CloudStock";

  return [
    `<b>[SENTRY ALERT] ${escapeHtml(title)}</b>`,
    ``,
    `<b>Project:</b> <code>${escapeHtml(projectName)}</code>`,
    `<b>Level:</b> <code>${escapeHtml(level)}</code>`,
    `<b>Culprit:</b> <code>${escapeHtml(culprit)}</code>`,
    `<b>Environment:</b> <code>${escapeHtml(environment)}</code>`,
    `<b>Release:</b> <code>${escapeHtml(release)}</code>`,
    ``,
    `• <a href="${escapeHtml(link)}">View Issue on Sentry</a>`,
    ``,
    `<i>Dispatched by Cloudflare Edge Watchdog</i>`,
  ].join("\n");
}

/**
 * Extracts a normalized issue ID for deduplication tracking.
 */
export function extractIssueId(payload: SentryWebhookPayload): string | null {
  const rawId =
    payload.issue?.id ??
    payload.data?.issue?.id ??
    payload.id ??
    payload.event?.event_id ??
    payload.data?.event?.event_id;

  return rawId !== undefined && rawId !== null ? String(rawId) : null;
}

/**
 * Dispatches an alert message to Telegram with exponential backoff retry.
 * Delays: 500ms, 1000ms, 2000ms (max 3 retries, total 4 attempts maximum).
 */
export async function dispatchTelegramWithRetry(
  botToken: string,
  chatId: string,
  htmlMessage: string,
  options?: TelegramDispatchOptions
): Promise<boolean> {
  const delays = options?.delaysMs ?? [500, 1000, 2000];
  const sleep = options?.sleepFn ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const customFetch = options?.fetchFn ?? ((url: string | URL | Request, init?: RequestInit) => fetch(url, init));

  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const body = JSON.stringify({
    chat_id: chatId,
    text: htmlMessage,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });

  const maxAttempts = 1 + delays.length;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await customFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (res.ok) {
        return true;
      }

      console.error(
        `[Sentry] Telegram dispatch failed with status: ${res.status} (attempt ${attempt}/${maxAttempts})`
      );
    } catch (err) {
      console.error(
        `[Sentry] Network error dispatching Telegram alert (attempt ${attempt}/${maxAttempts}):`,
        err
      );
    }

    if (attempt <= delays.length) {
      await sleep(delays[attempt - 1]);
    }
  }

  return false;
}

/**
 * Main Webhook Handler for incoming Sentry alerts.
 */
export async function handleSentryWebhook(
  request: Request,
  env: SentryEnv,
  options?: TelegramDispatchOptions
): Promise<Response> {
  // 1. Verify Secret Token
  if (!verifySentrySecret(request, env.SENTRY_WEBHOOK_SECRET)) {
    return new Response(JSON.stringify({ error: "Unauthorized: Invalid secret token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse JSON Payload
  let payload: SentryWebhookPayload;
  try {
    payload = (await request.json()) as SentryWebhookPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Bad Request: Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Determine bypass_dedup flag from URL query param or request header
  let bypassDedup = false;
  try {
    const parsedUrl = new URL(request.url);
    bypassDedup =
      parsedUrl.searchParams.get("bypass_dedup") === "true" ||
      request.headers.get("x-bypass-dedup") === "true";
  } catch {
    bypassDedup = request.headers.get("x-bypass-dedup") === "true";
  }

  const issueId = extractIssueId(payload);

  // 3. Deduplication Check via Cloudflare KV (TTL 15 minutes = 900s)
  // Bypassed if bypass_dedup is specified
  if (!bypassDedup && env.WATCHDOG_KV && issueId) {
    const kvKey = `sentry:seen:${issueId}`;
    try {
      const seen = await env.WATCHDOG_KV.get(kvKey);
      if (seen) {
        return new Response(
          JSON.stringify({
            ok: true,
            deduplicated: true,
            issue_id: issueId,
            message: "Duplicate alert suppressed within 15m window",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (kvErr) {
      console.warn("[Sentry] Failed to query KV for deduplication:", kvErr);
    }
  }

  // 4. Format HTML Alert Message
  const htmlMessage = formatSentryAlert(payload);

  // 5. Dispatch Alert to Telegram with Exponential Backoff Retry
  let dispatched = false;
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    dispatched = await dispatchTelegramWithRetry(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      htmlMessage,
      options
    );
  }

  // 6. Record Deduplication in KV
  if (env.WATCHDOG_KV && issueId) {
    const kvKey = `sentry:seen:${issueId}`;
    try {
      await env.WATCHDOG_KV.put(kvKey, new Date().toISOString(), {
        expirationTtl: 900,
      });
    } catch (kvErr) {
      console.warn("[Sentry] Failed to write KV deduplication key:", kvErr);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dispatched,
      issue_id: issueId,
      ...(bypassDedup ? { bypass_dedup: true } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
