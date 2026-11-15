import { executeProbe, type Env } from "./index.ts";
import { getDmsState, getTelemetryRingBuffer } from "./dms.ts";
import { summarizeTelemetry, generateQuickChartUrl, generateKumaChartUrl } from "./chart.ts";
import { sendTelegramPhoto, escapeHtml } from "./notifier.ts";

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
    return; // Ignore regular conversation
  }

  const parts = rawText.split(/\s+/);
  const command = parts[0].toLowerCase().split("@")[0];
  const chatId = msg.chat.id;
  const target = env.HEALTH_ENDPOINT || env.DEFAULT_HEALTH_ENDPOINT;

  if (command === "/status") {
    console.log(`[Commands] Executing /status for chat ${chatId}`);

    // 1. Live probe Cloud infrastructure
    const probe = await executeProbe(target);
    const serviceName = escapeHtml(env.ALERT_SERVICE_NAME || "Cloud Compute Prod");
    const cloudStatusText = probe.ok ? "HOẠT ĐỘNG BÌNH THƯỜNG" : "CẢNH BÁO / BẤT THƯỜNG";
    const dbDisplay = escapeHtml(probe.dbStatus || "disconnected");

    // 2. Query On-Premise DMS state from KV
    let onPremText = "Chưa cấu hình KV hoặc chưa có bản ghi check-in.";
    let summaryText = "";

    if (env.WATCHDOG_KV) {
      const dms = await getDmsState(env.WATCHDOG_KV);
      const graceSec = parseInt(env.DMS_GRACE_PERIOD_SEC || "1200", 10);
      const buffer = await getTelemetryRingBuffer(env.WATCHDOG_KV);
      const summary = summarizeTelemetry(buffer);

      if (dms) {
        const now = Date.now();
        const diffSec = Math.floor((now - dms.last_seen_epoch) / 1000);
        const diffMin = Math.round(diffSec / 60);
        const isUp = diffSec <= graceSec;
        const statusBadge = isUp ? "ONLINE (Đang kết nối)" : "OFFLINE / MẤT TÍN HIỆU";

        let kumaDetail = `• <b>Uptime Kuma:</b> <code>${escapeHtml(dms.uptime_kuma || "up")}</code>`;
        if (dms.kuma) {
          const k = dms.kuma;
          const uptimeStr = k.uptime_24h_percent !== undefined ? ` (${k.uptime_24h_percent}% 24h)` : "";
          const lines = [
            `• <b>Uptime Kuma:</b> <code>${k.monitors_up}/${k.monitors_total} UP</code>${uptimeStr}`,
          ];
          if (k.supabase_db_ping_ms !== undefined) {
            lines.push(`  - Supabase DB: <code>${k.supabase_db_ping_ms}ms</code>`);
          }
          if (k.vercel_api_ping_ms !== undefined) {
            lines.push(`  - Vercel Health: <code>${k.vercel_api_ping_ms}ms</code>`);
          }
          if (k.internet_uplink_ping_ms !== undefined) {
            lines.push(`  - Uplink (1.1.1.1): <code>${k.internet_uplink_ping_ms}ms</code>`);
          }
          kumaDetail = lines.join("\n");
        }

        onPremText = [
          `• <b>Node:</b> <code>${escapeHtml(dms.node)}</code> (${statusBadge})`,
          `• <b>Check-in lần cuối:</b> <code>${diffMin} phút trước (${diffSec}s)</code>`,
          kumaDetail,
          `• <b>Load Average:</b> <code>${dms.load_avg ?? "N/A"}</code> | <b>RAM:</b> <code>${dms.memory_used_mb ?? "N/A"}MB</code>`,
        ].join("\n");
      }

      if (summary.pointCount > 0) {
        summaryText = [
          ``,
          `<b>3. Xu Hướng Đo Đạc (8 Giờ Gần Nhất - ${summary.pointCount} mẫu):</b>`,
          `• Cloud Latency: <code>${summary.cloudLatencySpark}</code> (TB: ${summary.avgCloudLatency}ms, Max: ${summary.maxCloudLatency}ms)`,
          `• HP Node Load:  <code>${summary.hpLoadSpark}</code> (TB: ${summary.avgHpLoad})`,
          `<i>(Gõ <code>/chart</code> để xem biểu đồ chi tiết)</i>`,
        ].join("\n");
      }
    }

    const reply = [
      `<b>[HỆ THỐNG GIÁM SÁT TOÀN DIỆN]</b>`,
      `Dịch vụ: <b>${serviceName}</b>`,
      ``,
      `<b>1. Cụm Đám Mây (Vercel & Supabase):</b>`,
      `• <b>Trạng thái:</b> ${cloudStatusText}`,
      `• <b>HTTP Status:</b> <code>${probe.statusCode ?? "TIMEOUT"}</code>`,
      `• <b>Database:</b> <code>${dbDisplay}</code>`,
      `• <b>Độ trễ:</b> <code>${probe.durationMs}ms</code>`,
      ``,
      `<b>2. Cụm On-Premise (HP EliteDesk DMS):</b>`,
      onPremText,
      summaryText,
      ``,
      `<i>Thời điểm đánh giá: ${new Date().toISOString()}</i>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/chart" || command === "/chart_kuma") {
    console.log(`[Commands] Executing ${command} for chat ${chatId}`);

    if (!env.WATCHDOG_KV) {
      await sendTelegramReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Lưu trữ KV chưa được cấu hình. Không thể kết xuất biểu đồ."
      );
      return;
    }

    const buffer = await getTelemetryRingBuffer(env.WATCHDOG_KV);
    if (!buffer || buffer.length < 2) {
      await sendTelegramReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Chưa có đủ dữ liệu lịch sử để sinh biểu đồ (cần ít nhất 2 chu kỳ đo 10 phút)."
      );
      return;
    }

    const isKumaMode = parts[1]?.toLowerCase() === "kuma" || command === "/chart_kuma";
    let chartUrl: string;
    let caption: string;

    if (isKumaMode) {
      chartUrl = generateKumaChartUrl(buffer);
      caption = [
        `<b>[BIỂU ĐỒ ĐỘ TRỄ UPTIME KUMA (ON-PREMISE)]</b>`,
        `Dữ liệu ${buffer.length} chu kỳ gần nhất từ HP node (chu kỳ 10m):`,
        `• Supabase DB vs Vercel API vs Internet Uplink.`,
      ].join("\n");
    } else {
      chartUrl = generateQuickChartUrl(buffer);
      const summary = summarizeTelemetry(buffer);
      caption = [
        `<b>[BIỂU ĐỒ ĐỘ TRỄ & TẢI HỆ THỐNG]</b>`,
        `Dữ liệu ${buffer.length} chu kỳ gần nhất (chu kỳ 10m).`,
        `• Cloud Latency TB: <code>${summary.avgCloudLatency}ms</code> (Max: ${summary.maxCloudLatency}ms)`,
        `• On-Prem Load TB: <code>${summary.avgHpLoad}</code>`,
        `<i>(Mẹo: Gõ <code>/chart kuma</code> để xem biểu đồ chi tiết các monitor Kuma)</i>`,
      ].join("\n");
    }

    const sent = await sendTelegramPhoto(env.TELEGRAM_BOT_TOKEN, chatId, chartUrl, caption);
    if (!sent) {
      // Fallback to text link if photo dispatch failed
      const fallbackReply = `${caption}\n\n<a href="${chartUrl}">Nhấn vào đây để xem biểu đồ</a>`;
      await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, fallbackReply);
    }
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
      `• <code>/status</code> - Báo cáo tổng thể hợp nhất (Cloud Vercel/Supabase + On-Premise DMS).`,
      `• <code>/chart</code> - Xuất ảnh biểu đồ trực quan hóa độ trễ và tải CPU (QuickChart).`,
      `• <code>/chart kuma</code> - Xuất ảnh biểu đồ độ trễ các monitor Kuma (Supabase/Vercel/Uplink).`,
      `• <code>/ping</code> - Đo độ trễ từ Cloudflare Edge đến Vercel API.`,
      `• <code>/help</code> - Hiển thị danh mục lệnh hỗ trợ.`,
      ``,
      `<i>Hệ thống tự động thăm dò và kiểm tra nhịp tim định kỳ mỗi 10 phút.</i>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else {
    const safeCmd = escapeHtml(command);
    const reply = `Lệnh không hợp lệ: <code>${safeCmd}</code>\nGõ <code>/help</code> để xem danh sách lệnh được hỗ trợ.`;
    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  }
}
