import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devVarsPath = path.resolve(__dirname, "../.dev.vars");
const envLocalPath = path.resolve(__dirname, "../.env.local");

let content = "";
if (fs.existsSync(devVarsPath)) {
  content = fs.readFileSync(devVarsPath, "utf-8");
} else if (fs.existsSync(envLocalPath)) {
  content = fs.readFileSync(envLocalPath, "utf-8");
}

const tokenMatch = content.match(/TELEGRAM_BOT_TOKEN=["']?([^"'\r\n]+)["']?/);
if (!tokenMatch) {
  console.error("TELEGRAM_BOT_TOKEN not found!");
  process.exit(1);
}
const token = tokenMatch[1];
const secretMatch = content.match(/TELEGRAM_WEBHOOK_SECRET=["']?([^"'\r\n]+)["']?/);
const webhookSecret = secretMatch ? secretMatch[1].trim() : "";
const webhookUrl = "https://cc-cloud-watchdog.hunglepy05.workers.dev/telegram-webhook";

async function main() {
  console.log("[1/2] Đang đăng ký Webhook URL với Telegram API...");
  let setWebhookEndpoint = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
  if (webhookSecret) {
    console.log("[1/2] Đính kèm secret_token xác thực Telegram Webhook...");
    setWebhookEndpoint += `&secret_token=${encodeURIComponent(webhookSecret)}`;
  }
  const res = await fetch(setWebhookEndpoint);
  const data = await res.json();
  console.log("setWebhook:", data);

  console.log("[2/2] Đang cấu hình danh mục lệnh Bot Menu (setMyCommands)...");
  const commands = [
    { command: "status", description: "Bảng điều khiển toàn diện Cloud & On-Premise HP" },
    { command: "chart", description: "Biểu đồ trực quan (/chart [cloud | node | kuma])" },
    { command: "ping", description: "Đo độ trễ phản hồi tức thì từ Cloudflare Edge" },
    { command: "help", description: "Hướng dẫn chi tiết cú pháp các lệnh" },
  ];
  const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  const cmdData = await cmdRes.json();
  console.log("setMyCommands:", cmdData);

  console.log("[3/3] Kiểm tra thông tin Webhook (getWebhookInfo)...");
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoData = await infoRes.json();
  console.log("getWebhookInfo:", infoData);
}

main().catch(console.error);
