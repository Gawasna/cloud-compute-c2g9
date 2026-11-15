export interface KumaMonitorSummary {
  id: number;
  name?: string;
  status: "up" | "down" | "pending" | "maintenance";
  ping_ms?: number;
  uptime_24h?: number;
}

export interface KumaFailedEvent {
  monitor_id: number;
  monitor_name: string;
  time: string;
  msg: string;
  ping?: number | null;
}

export interface KumaSeriesPoint {
  time: string;
  supabase_ping?: number | null;
  vercel_health_ping?: number | null;
  vercel_front_ping?: number | null;
  uplink_ping?: number | null;
}

export interface KumaTelemetrySummary {
  status: "up" | "down";
  monitors_total: number;
  monitors_up: number;
  monitors_down: number;
  avg_ping_ms?: number;
  supabase_db_ping_ms?: number;
  vercel_api_ping_ms?: number;
  internet_uplink_ping_ms?: number;
  uptime_24h_percent?: number;
  monitors?: KumaMonitorSummary[];
  failed_events?: KumaFailedEvent[];
  series?: KumaSeriesPoint[];
}

export interface DmsCheckinPayload {
  node: string;
  uptime_kuma?: string;
  load_avg?: number;
  memory_used_mb?: number;
  memory_total_mb?: number;
  disk_used_percent?: number;
  uptime_sec?: number;
  timestamp?: string;
  kuma?: KumaTelemetrySummary;
}

export interface DmsState extends DmsCheckinPayload {
  last_seen_epoch: number;
  alerted_down?: boolean;
}

export interface TelemetryPoint {
  ts: number;
  cloud_ok?: boolean;
  cloud_duration_ms?: number;
  db_status?: string;
  db_latency_ms?: number;
  hp_ok?: boolean;
  hp_load?: number;
  hp_mem_mb?: number;
  hp_kuma_status?: string;
  kuma_monitors_up?: number;
  kuma_monitors_total?: number;
  kuma_supabase_ping_ms?: number;
  kuma_vercel_ping_ms?: number;
  kuma_uplink_ping_ms?: number;
  kuma_avg_ping_ms?: number;
}

export const DMS_STATE_KEY = "dms:elitedesk:state";
export const RING_BUFFER_KEY = "telemetry:ring_buffer";
export const MAX_RING_BUFFER_POINTS = 48; // 48 points * 10 min = 8 hours

/**
 * Performs a constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validates the Authorization Bearer token using constant-time comparison.
 */
export async function verifyDmsToken(
  authHeader: string | null,
  expectedToken: string | undefined
): Promise<boolean> {
  if (!expectedToken || !authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  return timingSafeEqualString(token, expectedToken);
}

/**
 * Records a check-in from the on-premise node and updates the telemetry buffer.
 */
export async function recordCheckin(
  kv: KVNamespace,
  payload: DmsCheckinPayload
): Promise<{ state: DmsState; wasRecovered: boolean }> {
  const previousState = await getDmsState(kv);
  const wasRecovered = !!previousState?.alerted_down;

  const state: DmsState = {
    ...payload,
    last_seen_epoch: Date.now(),
    alerted_down: false,
  };

  await kv.put(DMS_STATE_KEY, JSON.stringify(state));

  // Append on-premise snapshot into the Ring Buffer
  await appendTelemetryPoint(kv, {
    hp_ok: true,
    hp_load: payload.load_avg,
    hp_mem_mb: payload.memory_used_mb,
    hp_kuma_status: payload.kuma?.status ?? payload.uptime_kuma,
    kuma_monitors_up: payload.kuma?.monitors_up,
    kuma_monitors_total: payload.kuma?.monitors_total,
    kuma_supabase_ping_ms: payload.kuma?.supabase_db_ping_ms,
    kuma_vercel_ping_ms: payload.kuma?.vercel_api_ping_ms,
    kuma_uplink_ping_ms: payload.kuma?.internet_uplink_ping_ms,
    kuma_avg_ping_ms: payload.kuma?.avg_ping_ms,
  });

  return { state, wasRecovered };
}

/**
 * Retrieves the current DMS state of the on-premise node.
 */
export async function getDmsState(kv: KVNamespace): Promise<DmsState | null> {
  try {
    return await kv.get<DmsState>(DMS_STATE_KEY, "json");
  } catch (err: unknown) {
    console.error("[DMS] Error reading DMS state from KV:", err);
    return null;
  }
}

/**
 * Appends a new metric observation to the rolling Ring Buffer.
 */
export async function appendTelemetryPoint(
  kv: KVNamespace,
  point: Partial<TelemetryPoint>
): Promise<void> {
  try {
    const raw = await kv.get<TelemetryPoint[]>(RING_BUFFER_KEY, "json");
    const buffer = Array.isArray(raw) ? raw : [];
    const newPoint: TelemetryPoint = {
      ts: Math.floor(Date.now() / 1000),
      ...point,
    };
    buffer.push(newPoint);

    // Keep only the most recent points
    const trimmed = buffer.slice(-MAX_RING_BUFFER_POINTS);
    await kv.put(RING_BUFFER_KEY, JSON.stringify(trimmed));
  } catch (err: unknown) {
    console.error("[DMS] Error appending to telemetry ring buffer:", err);
  }
}

/**
 * Retrieves the recent telemetry history.
 */
export async function getTelemetryRingBuffer(kv: KVNamespace): Promise<TelemetryPoint[]> {
  try {
    const raw = await kv.get<TelemetryPoint[]>(RING_BUFFER_KEY, "json");
    return Array.isArray(raw) ? raw : [];
  } catch (err: unknown) {
    console.error("[DMS] Error reading ring buffer:", err);
    return [];
  }
}

/**
 * Evaluates whether the on-premise node has exceeded its grace period.
 */
export async function evaluateDmsTimeout(
  kv: KVNamespace,
  gracePeriodSec: number
): Promise<{ silent: boolean; diffSec: number; state: DmsState | null; shouldAlert: boolean }> {
  const state = await getDmsState(kv);
  if (!state) {
    return { silent: false, diffSec: 0, state: null, shouldAlert: false };
  }

  const now = Date.now();
  const diffSec = Math.floor((now - state.last_seen_epoch) / 1000);

  if (diffSec > gracePeriodSec) {
    if (!state.alerted_down) {
      // Transition from UP to DOWN: flag as alerted to prevent spamming
      state.alerted_down = true;
      await kv.put(DMS_STATE_KEY, JSON.stringify(state));
      return { silent: true, diffSec, state, shouldAlert: true };
    }
    return { silent: true, diffSec, state, shouldAlert: false };
  }

  return { silent: false, diffSec, state, shouldAlert: false };
}
