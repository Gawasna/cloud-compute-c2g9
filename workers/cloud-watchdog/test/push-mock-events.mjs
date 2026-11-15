/**
 * Script: push-mock-events.mjs
 * Purpose: Push live mock events to cc-cloud-watchdog to verify First Stream alerting in Telegram
 */

const WORKER_BASE = "https://cc-cloud-watchdog.hunglepy05.workers.dev";
const SENTRY_SECRET = "mock-sentry-token";
const SUPABASE_SECRET = "mock-supabase-token";
const DMS_SECRET = "mock-dms-token";

async function pushSentryMock() {
  console.log("\n[1/3] Đang gửi Mock Event Sentry (P0 Fatal Crash)...");
  const issueId = "mock-sentry-" + Date.now();
  const payload = {
    action: "created",
    data: {
      issue: {
        id: issueId,
        title: "TypeError: Cannot read properties of undefined (reading 'stock_quantity')",
        culprit: "/api/movements/outbound",
        permalink: "https://gawasu.sentry.io/issues/?project=cloudstock",
        level: "fatal",
        status: "unresolved",
        project: {
          slug: "cloudstock",
          name: "CloudStock (gawasu)",
        },
      },
      event: {
        event_id: "e99f" + Math.floor(Math.random() * 100000),
        environment: "production",
        release: "v0.2.0-rc1",
      },
    },
  };

  const res = await fetch(`${WORKER_BASE}/api/sentry-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sentry-token": SENTRY_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  console.log(`[Sentry Webhook] HTTP ${res.status}:`, body);
}

async function pushSupabaseMock() {
  console.log("\n[2/3] Đang gửi Mock Event Supabase (Critical Stock Exhaustion Trigger)...");
  const payload = {
    type: "UPDATE",
    table: "products",
    schema: "public",
    record: {
      id: "prd_st25_jasmine",
      name: "Gạo thơm Jasmine ST25 5kg",
      sku: "SKU-ST25-5KG",
      quantity: 0,
      minimum_stock: 20,
      status: "out_of_stock",
      updated_at: new Date().toISOString(),
    },
    old_record: {
      id: "prd_st25_jasmine",
      quantity: 8,
      status: "low_stock",
    },
  };

  const res = await fetch(`${WORKER_BASE}/api/supabase-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-supabase-token": SUPABASE_SECRET,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  console.log(`[Supabase Webhook] HTTP ${res.status}:`, body);
}

async function pushBugsinkSpikeMock() {
  console.log("\n[3/3] Đang gửi Mock Heartbeat BugSink (Spike 24 errors / 10m)...");
  const payload = {
    node: "elitedesk-mint",
    uptime_kuma: "up",
    load_avg: 0.38,
    memory_used_mb: 3180,
    memory_total_mb: 7712,
    uptime_sec: 349100,
    timestamp: new Date().toISOString(),
    bugsink: {
      status: "ok",
      total_issues: 14,
      total_events: 382,
      delta_events: 24, // Vượt ngưỡng 15
      recent_issues: [
        {
          id: 14,
          type: "RedisConnectionTimeout",
          value: "Failed to connect to internal Upstash cache within 2000ms",
        },
        {
          id: 13,
          type: "UnhandledPromiseRejection",
          value: "Payload decompression worker thread terminated unexpectedly",
        },
      ],
    },
  };

  const res = await fetch(`${WORKER_BASE}/api/dms/checkin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DMS_SECRET}`,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  console.log(`[DMS Check-in / BugSink Spike] HTTP ${res.status}:`, body);
}

async function main() {
  console.log("=== BẮT ĐẦU ĐẨY LIVE MOCK EVENTS TỚI CLOUDFLARE EDGE WATCHDOG ===");
  await pushSentryMock();
  await pushSupabaseMock();
  await pushBugsinkSpikeMock();
  console.log("\n=== HOÀN TẤT ĐẨY MOCK EVENTS! HÃY KIỂM TRA TELEGRAM CHAT. ===");
}

main().catch(console.error);
