export interface TelegramAlertPayload {
  service: string;
  url: string;
  statusCode?: number;
  error?: string;
  dbStatus?: string;
  durationMs: number;
  timestamp: string;
}

/**
 * Escapes HTML characters for Telegram HTML message formatting.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Dispatches an alert message to Telegram via Bot API sendMessage using HTML format.
 */
export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  alert: TelegramAlertPayload
): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const statusDisplay = alert.statusCode !== undefined ? `${alert.statusCode}` : "TIMEOUT / NETWORK ERROR";
  const dbDisplay = alert.dbStatus || "UNAVAILABLE";
  const errorDisplay = alert.error ? escapeHtml(alert.error) : "No explicit error payload";
  const serviceDisplay = escapeHtml(alert.service);
  const urlDisplay = escapeHtml(alert.url);

  const htmlMessage = [
    `<b>[CRITICAL ALERT] ${serviceDisplay}</b>`,
    ``,
    `<b>Service State:</b> Degraded / Down`,
    `<b>Target:</b> <code>${urlDisplay}</code>`,
    `<b>HTTP Status:</b> <code>${statusDisplay}</code>`,
    `<b>DB Status:</b> <code>${dbDisplay}</code>`,
    `<b>Response Time:</b> <code>${alert.durationMs}ms</code>`,
    `<b>Error Detail:</b> <code>${errorDisplay}</code>`,
    `<b>Timestamp:</b> <code>${alert.timestamp}</code>`,
    ``,
    `<i>Dispatched by Cloudflare Edge Watchdog</i>`,
  ].join("\n");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Notifier] Telegram send failed with status ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (err: unknown) {
    console.error("[Notifier] Network error sending Telegram alert:", err);
    return false;
  }
}

/**
 * Dispatches a Dead Man's Switch timeout alert to Telegram when on-premise node is silent.
 */
export async function sendTelegramDmsAlert(
  botToken: string,
  chatId: string,
  info: { node: string; diffSec: number; gracePeriodSec: number; lastSeenIso: string }
): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const diffMin = Math.round(info.diffSec / 60);
  const graceMin = Math.round(info.gracePeriodSec / 60);

  const htmlMessage = [
    `<b>[CRITICAL ALERT] Dead Man's Switch Triggered!</b>`,
    ``,
    `<b>Hạ tầng On-Premise:</b> MẤT TÍN HIỆU / SẬP NGUỒN`,
    `<b>Node định danh:</b> <code>${escapeHtml(info.node)}</code>`,
    `<b>Thời gian im lặng:</b> <code>${diffMin} phút (${info.diffSec}s)</code>`,
    `<b>Ngưỡng ân hạn:</b> <code>${graceMin} phút</code>`,
    `<b>Check-in lần cuối:</b> <code>${info.lastSeenIso}</code>`,
    ``,
    `<i>Cảnh báo: Máy chủ HP EliteDesk có thể đã mất điện, rớt mạng LAN hoặc treo hệ điều hành.</i>`,
    `<i>Dispatched by Cloudflare Edge Watchdog</i>`,
  ].join("\n");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("[Notifier] Network error sending DMS alert:", err);
    return false;
  }
}

/**
 * Dispatches a recovery notification when on-premise node resumes check-ins.
 */
export async function sendTelegramDmsRecovery(
  botToken: string,
  chatId: string,
  info: { node: string; uptimeKuma?: string; loadAvg?: number }
): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const htmlMessage = [
    `<b>[RECOVERED] HP EliteDesk Node is Back Online</b>`,
    ``,
    `<b>Hạ tầng On-Premise:</b> ĐÃ KHÔI PHỤC KẾT NỐI`,
    `<b>Node định danh:</b> <code>${escapeHtml(info.node)}</code>`,
    `<b>Uptime Kuma:</b> <code>${escapeHtml(info.uptimeKuma || "up")}</code>`,
    `<b>Load Avg:</b> <code>${info.loadAvg ?? "N/A"}</code>`,
    `<b>Thời điểm khôi phục:</b> <code>${new Date().toISOString()}</code>`,
    ``,
    `<i>Máy chủ on-premise đã gửi lại nhịp tim thành công tới Edge Watchdog.</i>`,
  ].join("\n");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("[Notifier] Network error sending DMS recovery:", err);
    return false;
  }
}

/**
 * Sends a photo to Telegram with an optional caption.
 */
export async function sendTelegramPhoto(
  botToken: string,
  chatId: string | number,
  photoUrl: string,
  caption?: string
): Promise<boolean> {
  const endpoint = `https://api.telegram.org/bot${botToken}/sendPhoto`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err: unknown) {
    console.error("[Notifier] Network error sending Telegram photo:", err);
    return false;
  }
}
