import { executeProbe, type Env } from "./index.ts";

export interface TelegramChat {
  id: number | string;
  title?: string;
  type: string;
}

export interface TelegramFrom {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramFrom;
  chat: TelegramChat;
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

/**
 * Escapes HTML special characters for Telegram message safety.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Dispatches an HTML-formatted message back to the target Telegram chat.
 */
export async function sendTelegramReply(
  botToken: string,
  chatId: number | string,
  htmlText: string
): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Commands] Failed to send Telegram reply (${res.status}): ${errText}`);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error("[Commands] Network error sending Telegram reply:", err);
    return false;
  }
}

/**
 * Processes incoming Telegram updates and executes supported slash commands.
 */
export async function handleTelegramCommand(
  update: TelegramUpdate,
  env: Env
): Promise<void> {
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text || !env.TELEGRAM_BOT_TOKEN) {
    return;
  }

  // 1. Whitelist Verification: Strictly reject messages from unapproved chats
  if (env.TELEGRAM_CHAT_ID && String(msg.chat.id) !== String(env.TELEGRAM_CHAT_ID)) {
    console.warn(`[Commands] Rejected unauthorized command attempt from chat ID: ${msg.chat.id}`);
    return;
  }

  const rawText = msg.text.trim();
  if (!rawText.startsWith("/")) {
    // Ignore normal chat messages to prevent group noise
    return;
  }

  // Strip bot mention if command invoked as /status@c2g9_bot
  const parts = rawText.split(/\s+/);
  const command = parts[0].toLowerCase().split("@")[0];
  const chatId = msg.chat.id;
  const target = env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT;

  if (command === "/status") {
    console.log(`[Commands] Executing /status on demand for chat ${chatId}`);
    const probe = await executeProbe(target);
    const serviceName = escapeHtml(env.ALERT_SERVICE_NAME || "Cloud Compute Prod");
    const statusText = probe.ok ? "HOẠT ĐỘNG BÌNH THƯỜNG" : "CẢNH BÁO / BẤT THƯỜNG";
    const dbDisplay = escapeHtml(probe.dbStatus || "disconnected");

    const reply = [
      `<b>[SYSTEM SNAPSHOT] ${serviceName}</b>`,
      ``,
      `<b>Tình trạng:</b> ${statusText}`,
      `<b>HTTP Status:</b> <code>${probe.statusCode ?? "TIMEOUT"}</code>`,
      `<b>Database Status:</b> <code>${dbDisplay}</code>`,
      `<b>Độ trễ phản hồi:</b> <code>${probe.durationMs}ms</code>`,
      `<b>Target Endpoint:</b> <code>${escapeHtml(target)}</code>`,
      `<b>Thời điểm đo:</b> <code>${new Date().toISOString()}</code>`,
      ``,
      `<i>Tra cứu trực tiếp từ Cloudflare Edge</i>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/ping") {
    console.log(`[Commands] Executing /ping for chat ${chatId}`);
    const start = Date.now();
    let edgeLatency = 0;
    let reachable = false;

    try {
      const probeRes = await fetch(target, {
        method: "GET",
        headers: { "User-Agent": "Cloudflare-Worker-Cloud-Watchdog/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      edgeLatency = Date.now() - start;
      reachable = probeRes.ok;
    } catch {
      edgeLatency = Date.now() - start;
    }

    const reply = [
      `<b>[PONG] Cloud Watchdog Edge Worker</b>`,
      ``,
      `<b>Edge Status:</b> Online (Active)`,
      `<b>Vercel Endpoint:</b> <code>${reachable ? "Reachable" : "Unreachable"}</code>`,
      `<b>Network Latency:</b> <code>${edgeLatency}ms</code>`,
      `<b>Worker Timestamp:</b> <code>${new Date().toISOString()}</code>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/help") {
    const reply = [
      `<b>[DANH MỤC LỆNH GIÁM SÁT WATCHDOG]</b>`,
      ``,
      `• <code>/status</code> - Thăm dò tức thì Vercel Health & Supabase Database.`,
      `• <code>/ping</code> - Đo độ trễ từ Cloudflare Edge đến Vercel API.`,
      `• <code>/help</code> - Hiển thị danh mục lệnh hỗ trợ.`,
      ``,
      `<i>Worker tự động thăm dò định kỳ mỗi 10 phút.</i>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else {
    const safeCmd = escapeHtml(command);
    const reply = `Lệnh không hợp lệ: <code>${safeCmd}</code>\nGõ <code>/help</code> để xem danh sách lệnh được hỗ trợ.`;
    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  }
}
