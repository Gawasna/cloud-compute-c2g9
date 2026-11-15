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
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
