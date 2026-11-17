import { executeProbe, type Env } from "./index.ts";
import { getDmsState, getTelemetryRingBuffer } from "./dms.ts";
import { formatBugsinkSummary } from "./bugsink.ts";
import {
  summarizeTelemetry,
  generateCloudChartUrl,
  generateNodeChartUrl,
  generateKumaChartUrl,
  generateBugsinkChartUrl,
} from "./chart.ts";
import { sendTelegramPhoto, escapeHtml } from "./notifier.ts";

export const WATCHDOG_SILENCE_KEY = "watchdog:silence:active";

/**
 * Formats a given epoch millisecond timestamp into GMT+7 (Asia/Ho_Chi_Minh) readable string.
 */
export function formatGmt7String(epochMs: number = Date.now()): string {
  const d = new Date(epochMs + 7 * 3600 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} (GMT+7)`;
}

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

    // Supabase Latency State from KV (UX2)
    let supabaseLatencyText = "";
    if (env.WATCHDOG_KV) {
      try {
        const rawLatency = await env.WATCHDOG_KV.get("supabase:latency:state");
        if (rawLatency) {
          const sState = typeof rawLatency === "string" ? JSON.parse(rawLatency) : rawLatency;
          const stateBadge = sState.alerted_degraded ? "CẢNH BÁO SUY GIẢM" : "BÌNH THƯỜNG";
          supabaseLatencyText = `• <b>Supabase Latency State:</b> <code>${sState.last_latency_ms ?? "N/A"}ms</code> (${stateBadge})`;
        }
      } catch {
        // Safe fallback if parsing fails
      }
    }

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
        const lastSeenFormatted = formatGmt7String(dms.last_seen_epoch);

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
          `• <b>Check-in lần cuối:</b> <code>${diffMin} phút trước (${diffSec}s)</code> [${lastSeenFormatted}]`,
          kumaDetail,
          formatBugsinkSummary(dms.bugsink),
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

    const cloudBlock = [
      `<b>1. Cụm Đám Mây (Vercel & Supabase):</b>`,
      `• <b>Trạng thái:</b> ${cloudStatusText}`,
      `• <b>HTTP Status:</b> <code>${probe.statusCode ?? "TIMEOUT"}</code>`,
      `• <b>Database:</b> <code>${dbDisplay}</code>`,
      `• <b>Độ trễ:</b> <code>${probe.durationMs}ms</code>`,
    ];
    if (supabaseLatencyText) {
      cloudBlock.push(supabaseLatencyText);
    }

    const reply = [
      `<b>[HỆ THỐNG GIÁM SÁT TOÀN DIỆN]</b>`,
      `Dịch vụ: <b>${serviceName}</b>`,
      ``,
      ...cloudBlock,
      ``,
      `<b>2. Cụm On-Premise (HP EliteDesk DMS):</b>`,
      onPremText,
      summaryText,
      ``,
      `<i>Thời điểm đánh giá: ${formatGmt7String()}</i>`,
      ``,
      `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/dms") {
    // UX3: Fast overview of on-premise node status without probing cloud
    console.log(`[Commands] Executing /dms for chat ${chatId}`);

    if (!env.WATCHDOG_KV) {
      await sendTelegramReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Lưu trữ KV chưa được cấu hình. Không thể truy vấn trạng thái DMS."
      );
      return;
    }

    const dms = await getDmsState(env.WATCHDOG_KV);
    if (!dms) {
      await sendTelegramReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "<b>[HẠ TẦNG ON-PREMISE (DMS)]</b>\nChưa có bản ghi check-in nào từ máy chủ On-Premise."
      );
      return;
    }

    const graceSec = parseInt(env.DMS_GRACE_PERIOD_SEC || "1200", 10);
    const now = Date.now();
    const diffSec = Math.floor((now - dms.last_seen_epoch) / 1000);
    const diffMin = Math.round(diffSec / 60);
    const isUp = diffSec <= graceSec;
    const statusBadge = isUp ? "ONLINE (Đang kết nối)" : "OFFLINE / MẤT TÍN HIỆU";
    const lastSeenFormatted = formatGmt7String(dms.last_seen_epoch);

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

    const reply = [
      `<b>[TRẠNG THÁI HẠ TẦNG ON-PREMISE (HP ELITEDESK)]</b>`,
      `• <b>Node định danh:</b> <code>${escapeHtml(dms.node)}</code> (${statusBadge})`,
      `• <b>Check-in lần cuối:</b> <code>${diffMin} phút trước (${diffSec}s)</code> [${lastSeenFormatted}]`,
      kumaDetail,
      formatBugsinkSummary(dms.bugsink),
      `• <b>CPU Load Avg:</b> <code>${dms.load_avg ?? "N/A"}</code>`,
      `• <b>RAM sử dụng:</b> <code>${dms.memory_used_mb ?? "N/A"} MB / ${dms.memory_total_mb ?? 7712} MB</code>`,
      `• <b>Dung lượng Disk:</b> <code>${dms.disk_used_percent ?? "N/A"}%</code>`,
      ``,
      `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/silence") {
    // M3: Silence alert notifications for given minutes [5, 240], default 30
    console.log(`[Commands] Executing /silence for chat ${chatId}`);

    if (!env.WATCHDOG_KV) {
      await sendTelegramReply(
        env.TELEGRAM_BOT_TOKEN,
        chatId,
        "Lưu trữ KV chưa được cấu hình. Không thể kích hoạt chế độ im lặng."
      );
      return;
    }

    let minutes = 30;
    if (parts[1]) {
      const parsed = parseInt(parts[1], 10);
      if (isNaN(parsed) || parsed < 5 || parsed > 240) {
        await sendTelegramReply(
          env.TELEGRAM_BOT_TOKEN,
          chatId,
          "Thời gian im lặng không hợp lệ. Vui lòng nhập số phút trong dải [5, 240] (mặc định: 30 phút).\nVí dụ: <code>/silence 60</code>"
        );
        return;
      }
      minutes = parsed;
    }

    const expirationTtl = minutes * 60;
    const expireAtEpoch = Date.now() + expirationTtl * 1000;
    const expireTimeStr = formatGmt7String(expireAtEpoch);

    await env.WATCHDOG_KV.put(WATCHDOG_SILENCE_KEY, String(expireAtEpoch), {
      expirationTtl,
    });

    const reply = [
      `<b>[CHẾ ĐỘ IM LẶNG - SILENCE ACTIVATED]</b>`,
      ``,
      `Chế độ im lặng đã được kích hoạt trong <b>${minutes} phút</b>.`,
      `Tất cả thông báo cảnh báo định kỳ và phát hiện bất thường sẽ tạm dừng gửi cho đến:`,
      `<code>${expireTimeStr}</code>`,
      ``,
      `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (
    command === "/chart" ||
    command === "/chart_kuma" ||
    command === "/chart_node" ||
    command === "/chart_cloud" ||
    command === "/chart_bugsink"
  ) {
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

    const subcmd = parts[1]?.toLowerCase();
    const isKumaMode = subcmd === "kuma" || command === "/chart_kuma";
    const isNodeMode = subcmd === "node" || subcmd === "hp" || command === "/chart_node";
    const isBugsinkMode = subcmd === "bugsink" || command === "/chart_bugsink";
    let chartUrl: string;
    let caption: string;

    if (isBugsinkMode) {
      // UX4: Render BugSink error chart from ring buffer
      chartUrl = generateBugsinkChartUrl(buffer);
      const dms = await getDmsState(env.WATCHDOG_KV);
      const issuesDisplay = dms?.bugsink?.total_issues !== undefined ? String(dms.bugsink.total_issues) : "N/A";
      const eventsDisplay = dms?.bugsink?.total_events !== undefined ? String(dms.bugsink.total_events) : "N/A";

      caption = [
        `<b>[BIỂU ĐỒ SỰ CỐ BUGSINK (ON-PREMISE)]</b>`,
        `Dữ liệu từ chu kỳ kiểm tra ring buffer HP Node:`,
        `• <b>Tổng sự kiện lỗi (Events):</b> <code>${eventsDisplay}</code>`,
        `• <b>Issues chưa giải quyết:</b> <code>${issuesDisplay}</code>`,
        `• <b>BugSink Dashboard:</b> http://100.103.109.18:35800/issues/2/`,
        ``,
        `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
      ].join("\n");
    } else if (isKumaMode) {
      const dms = await getDmsState(env.WATCHDOG_KV);
      const kSeries = dms?.kuma?.series;

      if (kSeries && kSeries.length >= 2) {
        chartUrl = generateKumaChartUrl(kSeries);
        const fails = dms?.kuma?.failed_events || [];
        let failedSection = "• <b>Sự kiện lỗi (24h qua):</b> <code>0 sự cố (100% OK)</code>";
        if (fails.length > 0) {
          const failLines = fails.slice(-5).map(
            (f) => `  ⚠️ [${escapeHtml(f.time)}] ${escapeHtml(f.monitor_name)}: ${escapeHtml(f.msg)}`
          );
          failedSection = `• <b>Sự kiện lỗi (${fails.length} sự cố gần nhất):</b>\n${failLines.join("\n")}`;
        }

        caption = [
          `<b>[BIỂU ĐỒ ĐỘ TRỄ 8H UPTIME KUMA (ON-PREMISE)]</b>`,
          `Chuỗi ${kSeries.length} mốc thời gian thực tế (8 giờ qua) từ HP node:`,
          `• <b>Supabase DB:</b> <code>${dms?.kuma?.supabase_db_ping_ms ?? "N/A"}ms</code>`,
          `• <b>Vercel Health:</b> <code>${dms?.kuma?.vercel_api_ping_ms ?? "N/A"}ms</code>`,
          `• <b>Internet Uplink:</b> <code>${dms?.kuma?.internet_uplink_ping_ms ?? "N/A"}ms</code>`,
          `• <b>Khả dụng 24h:</b> <code>${dms?.kuma?.uptime_24h_percent ?? 100}%</code>`,
          ``,
          failedSection,
          ``,
          `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
        ].join("\n");
      } else {
        // WE5: Dynamic failed events count instead of hardcoded 0
        chartUrl = generateKumaChartUrl(undefined, buffer);
        const fails = dms?.kuma?.failed_events || [];
        let failedSection = "• <b>Sự kiện lỗi:</b> <code>0 sự cố (100% OK)</code>";
        if (fails.length > 0) {
          const failLines = fails.slice(-5).map(
            (f) => `  ⚠️ [${escapeHtml(f.time)}] ${escapeHtml(f.monitor_name)}: ${escapeHtml(f.msg)}`
          );
          failedSection = `• <b>Sự kiện lỗi (${fails.length} sự cố gần nhất):</b>\n${failLines.join("\n")}`;
        }

        caption = [
          `<b>[BIỂU ĐỒ ĐỘ TRỄ UPTIME KUMA (ON-PREMISE)]</b>`,
          `Dữ liệu ${buffer.length} chu kỳ gần nhất từ HP node (chu kỳ 10m):`,
          `• Supabase DB vs Vercel API vs Internet Uplink.`,
          failedSection,
          ``,
          `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
        ].join("\n");
      }
    } else if (isNodeMode) {
      chartUrl = generateNodeChartUrl(buffer);
      const hpPoints = buffer.filter((p) => p.hp_load !== undefined || p.hp_mem_mb !== undefined);
      const loads = hpPoints.map((p) => p.hp_load).filter((v): v is number => typeof v === "number");
      const mems = hpPoints.map((p) => p.hp_mem_mb).filter((v): v is number => typeof v === "number");
      const avgLoad = loads.length ? (loads.reduce((a, b) => a + b, 0) / loads.length).toFixed(2) : "N/A";
      const avgMem = mems.length ? Math.round(mems.reduce((a, b) => a + b, 0) / mems.length) : "N/A";

      caption = [
        `<b>[BIỂU ĐỒ TÀI NGUYÊN MÁY CHỦ HP NODE]</b>`,
        `Dữ liệu ${hpPoints.length} chu kỳ đo từ service account ikari (chu kỳ 10m):`,
        `• <b>CPU Load Avg TB:</b> <code>${avgLoad}</code>`,
        `• <b>RAM sử dụng TB:</b> <code>${avgMem} MB / 7712 MB</code>`,
        ``,
        `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
      ].join("\n");
    } else {
      // Cloud Performance: Edge API Latency vs Supabase DB Latency
      chartUrl = generateCloudChartUrl(buffer);
      const cloudPoints = buffer.filter((p) => p.cloud_duration_ms !== undefined);
      const latencies = cloudPoints.map((p) => p.cloud_duration_ms).filter((v): v is number => typeof v === "number");
      const dbLatencies = cloudPoints.map((p) => p.db_latency_ms).filter((v): v is number => typeof v === "number");
      const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
      const maxLatency = latencies.length ? Math.max(...latencies) : 0;
      const avgDb = dbLatencies.length ? Math.round(dbLatencies.reduce((a, b) => a + b, 0) / dbLatencies.length) : null;
      const dbLine = avgDb !== null ? `• <b>Supabase DB Latency TB:</b> <code>${avgDb} ms</code>` : null;

      caption = [
        `<b>[BIỂU ĐỒ HIỆU NĂNG CLOUD (VERCEL & SUPABASE)]</b>`,
        `Phân rã độ trễ API Edge vs Truy vấn Database (${cloudPoints.length} chu kỳ 10m):`,
        `• <b>Total API Latency TB:</b> <code>${avgLatency} ms</code> (Max: ${maxLatency} ms)`,
        dbLine,
        ``,
        `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
      ].filter(Boolean).join("\n");
    }

    const sent = await sendTelegramPhoto(env.TELEGRAM_BOT_TOKEN, chatId, chartUrl, caption);
    if (!sent) {
      // Fallback to text link if photo dispatch failed
      const fallbackReply = `${caption}\n\n<a href="${chartUrl}">Nhấn vào đây để xem biểu đồ</a>`;
      await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, fallbackReply);
    }
  } else if (command === "/ping") {
    // WE3: Distinctly separate network reachability from application status
    console.log(`[Commands] Executing /ping for chat ${chatId}`);
    const start = Date.now();
    let edgeLatency = 0;
    let endpointStatus = "Unreachable (Connection Failed)";

    try {
      const probeRes = await fetch(target, {
        method: "GET",
        headers: { "User-Agent": "Cloudflare-Worker-Cloud-Watchdog/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      edgeLatency = Date.now() - start;
      if (probeRes.ok) {
        endpointStatus = `Reachable (HTTP ${probeRes.status} OK)`;
      } else {
        endpointStatus = `Reached (HTTP ${probeRes.status} - App Degraded)`;
      }
    } catch {
      edgeLatency = Date.now() - start;
      endpointStatus = "Unreachable (Connection Failed)";
    }

    const reply = [
      `<b>[PONG] Cloud Watchdog Edge Worker</b>`,
      ``,
      `<b>Edge Status:</b> Online (Active)`,
      `<b>Vercel Endpoint:</b> <code>${endpointStatus}</code>`,
      `<b>Network Latency:</b> <code>${edgeLatency}ms</code>`,
      `<b>Worker Timestamp:</b> <code>${formatGmt7String()}</code>`,
      ``,
      `💡 Gõ /status để xem chi tiết | /dms để kiểm tra on-premise node`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else if (command === "/help") {
    // UX6: Updated command catalogue with all new commands and aliases
    const reply = [
      `<b>[DANH MỤC LỆNH GIÁM SÁT WATCHDOG]</b>`,
      ``,
      `• <code>/status</code> - Báo cáo tổng thể hợp nhất (Cloud Vercel/Supabase + On-Premise DMS).`,
      `• <code>/dms</code> - Xem nhanh trạng thái máy chủ On-Premise (HP Node) không cần probe cloud.`,
      `• <code>/silence [phút]</code> - Tạm dừng gửi cảnh báo trong 5-240 phút (mặc định 30 phút).`,
      `• <code>/chart</code> - Biểu đồ hiệu năng Cloud (Độ trễ Edge API vs Supabase DB).`,
      `• <code>/chart node</code> - Biểu đồ tài nguyên máy chủ HP Node (CPU Load & RAM MB).`,
      `• <code>/chart kuma</code> - Biểu đồ độ trễ 8h Uptime Kuma & sự kiện lỗi Failed Events.`,
      `• <code>/chart bugsink</code> - Biểu đồ theo dõi lỗi và sự kiện BugSink Issue Tracker.`,
      `• <code>/ping</code> - Đo độ trễ từ Cloudflare Edge đến Vercel API & kiểm tra kết nối.`,
      `• <code>/help</code> - Hiển thị danh mục lệnh hỗ trợ.`,
      ``,
      `<i>Aliases hỗ trợ: /chart_cloud, /chart_node, /chart_kuma, /chart_bugsink</i>`,
      `<i>Hệ thống tự động thăm dò và kiểm tra nhịp tim định kỳ mỗi 10 phút.</i>`,
    ].join("\n");

    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  } else {
    const safeCmd = escapeHtml(command);
    const reply = `Lệnh không hợp lệ: <code>${safeCmd}</code>\nGõ <code>/help</code> để xem danh sách lệnh được hỗ trợ.`;
    await sendTelegramReply(env.TELEGRAM_BOT_TOKEN, chatId, reply);
  }
}
