/**
 * Script: register-webhook.mjs
 * Purpose: Register Cloudflare Worker URL as Telegram Bot Webhook endpoint.
 * Configuration: Reads TELEGRAM_BOT_TOKEN and optional TELEGRAM_WEBHOOK_SECRET from environment.
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ? process.env.TELEGRAM_WEBHOOK_SECRET.trim() : "";
const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || "https://cc-cloud-watchdog.hunglepy05.workers.dev/telegram-webhook";

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN not provided in environment variables!");
  console.error("Usage: TELEGRAM_BOT_TOKEN=<token> [TELEGRAM_WEBHOOK_SECRET=<secret>] node test/register-webhook.mjs");
  process.exit(1);
}

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
