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
const webhookUrl = "https://cc-cloud-watchdog.hunglepy05.workers.dev/telegram-webhook";

async function main() {
  console.log("[1/2] Đang đăng ký Webhook URL với Telegram API...");
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
  const data = await res.json();
  console.log("setWebhook:", data);

  console.log("[2/2] Đang cấu hình danh mục lệnh Bot Menu (setMyCommands)...");
  const commands = [
    { command: "status", description: "Kiểm tra tức thì Vercel & Supabase DB" },
    { command: "ping", description: "Đo độ trễ từ Edge tới Health Endpoint" },
    { command: "help", description: "Hiển thị danh mục lệnh hỗ trợ" },
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
