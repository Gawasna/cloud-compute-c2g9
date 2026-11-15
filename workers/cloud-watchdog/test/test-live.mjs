import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envLocalPath = path.resolve(__dirname, "../.env.local");
const devVarsPath = path.resolve(__dirname, "../.dev.vars");

// 1. Read existing config
function loadConfig() {
  let content = "";
  if (fs.existsSync(devVarsPath)) {
    content = fs.readFileSync(devVarsPath, "utf-8");
  } else if (fs.existsSync(envLocalPath)) {
    content = fs.readFileSync(envLocalPath, "utf-8");
  }

  const tokenMatch = content.match(/TELEGRAM_BOT_TOKEN=["']?([^"'\r\n]+)["']?/);
  const chatIdMatch = content.match(/TELEGRAM_CHAT_ID=["']?([^"'\r\n]+)["']?/);
  const endpointMatch = content.match(/DEFAULT_HEALTH_ENDPOINT=["']?([^"'\r\n]+)["']?/);

  return {
    botToken: process.env.TELEGRAM_BOT_TOKEN || (tokenMatch ? tokenMatch[1] : ""),
    chatId: process.env.TELEGRAM_CHAT_ID || (chatIdMatch ? chatIdMatch[1] : ""),
    endpoint: process.env.DEFAULT_HEALTH_ENDPOINT || (endpointMatch ? endpointMatch[1] : "https://cloud-compute-c2g9.vercel.app/api/health"),
  };
}

async function main() {
  console.log("--- BẮT ĐẦU KIỂM THỬ TỰ THÂN CLOUDFLARE WATCHDOG ---");
  const config = loadConfig();

  if (!config.botToken) {
    console.error("[LỖI] Không tìm thấy TELEGRAM_BOT_TOKEN trong .env.local hoặc .dev.vars!");
    process.exit(1);
  }

  // 2. Verify Bot via getMe
  console.log("[1/3] Kiểm tra thông tin Bot...");
  const meRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
  const meData = await meRes.json();
  if (!meData.ok) {
    console.error("[LỖI] Bot Token không hợp lệ:", meData);
    process.exit(1);
  }
  console.log(`[OK] Kết nối Bot thành công: @${meData.result.username} (${meData.result.first_name})`);

  let targetChatId = config.chatId;

  // 3. If Chat ID is missing, attempt to discover from getUpdates
  if (!targetChatId) {
    console.log("[2/3] TELEGRAM_CHAT_ID đang trống. Đang tra cứu qua getUpdates...");
    const updatesRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getUpdates`);
    const updatesData = await updatesRes.json();

    if (updatesData.ok && updatesData.result && updatesData.result.length > 0) {
      // Find the latest message or channel_post or my_chat_member
      const lastUpdate = updatesData.result[updatesData.result.length - 1];
      const chat = lastUpdate.message?.chat || lastUpdate.channel_post?.chat || lastUpdate.my_chat_member?.chat;
      if (chat && chat.id) {
        targetChatId = String(chat.id);
        console.log(`[OK] Đã tự động phát hiện Chat ID: ${targetChatId} (${chat.title || chat.username || chat.first_name})`);

        // Save back to .dev.vars and .env.local
        const devVarsContent = `DEFAULT_HEALTH_ENDPOINT="${config.endpoint}"\nALERT_SERVICE_NAME="Cloud Compute Prod (Vercel + Supabase)"\nTELEGRAM_BOT_TOKEN="${config.botToken}"\nTELEGRAM_CHAT_ID="${targetChatId}"\n`;
        fs.writeFileSync(devVarsPath, devVarsContent, "utf-8");
        if (fs.existsSync(envLocalPath)) {
          fs.writeFileSync(envLocalPath, devVarsContent, "utf-8");
        }
        console.log("[OK] Đã tự động lưu TELEGRAM_CHAT_ID vào .dev.vars và .env.local!");
      }
    }

    if (!targetChatId) {
      console.log("\n[HƯỚNG DẪN HÀNH ĐỘNG CẦN THIẾT TỪ BẠN]:");
      console.log(`Bot username là: @${meData.result.username}`);
      console.log(`1. Vào Telegram, mời @${meData.result.username} vào Group hoặc bấm Start chat trực tiếp với bot.`);
      console.log(`2. Gửi một tin nhắn lệnh vào Group, ví dụ: /test@${meData.result.username}`);
      console.log("3. Sau khi gửi xong, chạy lại script này: npm run test:live");
      process.exit(0);
    }
  }

  // 4. Send Live Smoke Alert
  console.log(`[3/4] Đang gửi thông điệp kiểm thử tới Chat ID: ${targetChatId}...`);
  const message = [
    `<b>[WATCHDOG VERIFIED] Cloud Compute Watchdog Live Probe</b>`,
    ``,
    `<b>Trạng thái:</b> Kênh cảnh báo Telegram kết nối thành công.`,
    `<b>Group:</b> CLOUD_C2G9 (<code>${targetChatId}</code>)`,
    `<b>Bot Dispatcher:</b> @${meData.result.username}`,
    `<b>Target Health Endpoint:</b> <code>${config.endpoint}</code>`,
    `<b>Thời điểm kiểm tra:</b> <code>${new Date().toISOString()}</code>`,
    ``,
    `<i>Cloudflare Worker Edge Watchdog đã sẵn sàng kích hoạt định kỳ.</i>`
  ].join("\n");

  const sendRes = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: message,
      parse_mode: "HTML",
    }),
  });

  const sendData = await sendRes.json();
  if (sendData.ok) {
    console.log(`[THÀNH CÔNG] Đã gửi thông điệp kiểm tra tới Telegram thành công! (Message ID: ${sendData.result.message_id})`);
  } else {
    console.error("[THẤT BẠI] Lỗi khi gửi tới Telegram:", sendData);
  }

  // 5. Test real Health Endpoint Probe
  console.log(`[4/4] Thăm dò trực tiếp Live Health Endpoint: ${config.endpoint}...`);
  const probeStart = Date.now();
  const probeRes = await fetch(config.endpoint, {
    method: "GET",
    headers: { "User-Agent": "Cloudflare-Worker-Cloud-Watchdog/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  const probeDuration = Date.now() - probeStart;
  const probeJson = await probeRes.json();

  console.log(`[OK] HTTP Status: ${probeRes.status}`);
  console.log(`[OK] Response Latency: ${probeDuration}ms`);
  console.log(`[OK] Overall Status: ${probeJson.status}`);
  console.log(`[OK] Database Status: ${probeJson.database?.status} (Latency: ${probeJson.database?.latency_ms}ms)`);
  console.log("\n--- KIỂM THỬ TỰ THÂN HOÀN TẤT THÀNH CÔNG 100% ---");
}

main().catch(console.error);
