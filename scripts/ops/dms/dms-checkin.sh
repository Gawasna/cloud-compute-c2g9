#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/ops/dms/dms-checkin.sh
# Purpose: Dead Man's Switch (DMS) outbound telemetry check-in from on-premise
#          HP EliteDesk node to Cloudflare Worker Edge Watchdog.
# Service Account: ikari (UID 1002)
# Cadence: 10 minutes (triggered by systemd user timer)
# ==============================================================================

set -euo pipefail

# 1. Source environment files if readable
if [[ -r "/home/ikari/ops/.env" ]]; then
    # shellcheck disable=SC1091
    source "/home/ikari/ops/.env"
fi

if [[ -r "/home/ikari/.env.dms" ]]; then
    # shellcheck disable=SC1091
    source "/home/ikari/.env.dms"
fi

# 2. Configuration & defaults
DMS_ENDPOINT="${DMS_ENDPOINT:-https://cc-cloud-watchdog.hunglepy05.workers.dev/api/dms/checkin}"
DMS_NODE_ID="${DMS_NODE_ID:-elitedesk-mint}"
DMS_SECRET_TOKEN="${DMS_SECRET_TOKEN:-}"

if [[ -z "${DMS_SECRET_TOKEN}" ]]; then
    echo "[ERROR] [$(date -u +"%Y-%m-%dT%H:%M:%SZ")] DMS_SECRET_TOKEN is empty. Check /home/ikari/.env.dms." >&2
    exit 1
fi

# 3. Harvest system telemetry metrics
LOAD_AVG=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo "0.0")

MEM_TOTAL="0"
MEM_USED="0"
if command -v free >/dev/null 2>&1; then
    MEM_TOTAL=$(free -m 2>/dev/null | awk '/^Mem:/{print $2}')
    MEM_USED=$(free -m 2>/dev/null | awk '/^Mem:/{print $3}')
fi

UPTIME_SEC="0"
if [[ -f "/proc/uptime" ]]; then
    UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo "0")
fi

# 4. Harvest rich Uptime Kuma telemetry (8h time-series & failed events)
KUMA_STATUS="down"
KUMA_TELEMETRY='{"status":"down"}'

if command -v python3 >/dev/null 2>&1; then
    PY_KUMA=$(python3 - << 'EOF' 2>/dev/null || true
import urllib.request, json

try:
    status_req = urllib.request.urlopen('http://127.0.0.1:3001/api/status-page/cloudstock', timeout=3)
    status_data = json.loads(status_req.read())

    hb_req = urllib.request.urlopen('http://127.0.0.1:3001/api/status-page/heartbeat/cloudstock', timeout=3)
    hb_data = json.loads(hb_req.read())

    monitor_names = {}
    for g in status_data.get('publicGroupList', []):
        for m in g.get('monitorList', []):
            monitor_names[str(m['id'])] = m['name']

    # Discover monitors dynamically by attributes/names
    monitors = {}
    for g in status_data.get('publicGroupList', []):
        for m in g.get('monitorList', []):
            name = m.get('name', '')
            mid = str(m.get('id'))
            if 'Supabase' in name or m.get('type') == 'postgres':
                monitors['supabase'] = mid
            elif 'Backend' in name or '/api/health' in name or m.get('type') == 'keyword':
                monitors['vercel_api'] = mid
            elif 'Frontend' in name:
                monitors['vercel_front'] = mid
            elif '1.1.1.1' in name or 'Cloudflare' in name:
                monitors['uplink'] = mid

    hb = hb_data.get('heartbeatList', {})
    uptime = hb_data.get('uptimeList', {})

    # 1. Extract Failed Events
    failed_events = []
    for m_id, points in hb.items():
        name = monitor_names.get(m_id, f'Monitor {m_id}')
        for p in points:
            if p.get('status') == 0:
                failed_events.append({
                    'monitor_id': int(m_id),
                    'monitor_name': name,
                    'time': p.get('time', ''),
                    'msg': p.get('msg', 'Down'),
                    'ping': p.get('ping')
                })

    # 2. Extract Downsampled Time-Series (~20 points over 8h) with Timestamp Alignment
    import datetime

    def parse_time(t_str):
        try:
            return datetime.datetime.strptime(t_str.split('.')[0], '%Y-%m-%d %H:%M:%S').timestamp()
        except Exception:
            return 0

    base_id = monitors.get('supabase', '1')
    base_points = hb.get(base_id, [])

    other_lookups = {}
    for key in ['vercel_api', 'vercel_front', 'uplink']:
        mid = monitors.get(key)
        pts = hb.get(mid, [])
        other_lookups[key] = [(parse_time(p['time']), p.get('ping')) for p in pts if 'time' in p]

    def find_closest_ping(target_ts, ts_list, max_tolerance=300):
        if not ts_list or target_ts == 0:
            return None
        closest = min(ts_list, key=lambda x: abs(x[0] - target_ts))
        if abs(closest[0] - target_ts) <= max_tolerance:
            return closest[1]
        return None

    step = max(1, len(base_points) // 20)
    indices = list(range(0, len(base_points), step))
    if len(base_points) > 0 and indices[-1] != len(base_points) - 1:
        indices.append(len(base_points) - 1)

    series = []
    for idx in indices:
        p1 = base_points[idx]
        raw_time = p1.get('time', '')
        ts = parse_time(raw_time)
        short_time = raw_time[11:16] if len(raw_time) >= 16 else f'P{idx}'
        series.append({
            'time': short_time,
            'supabase_ping': p1.get('ping'),
            'vercel_health_ping': find_closest_ping(ts, other_lookups.get('vercel_api', []), 300),
            'vercel_front_ping': find_closest_ping(ts, other_lookups.get('vercel_front', []), 300),
            'uplink_ping': find_closest_ping(ts, other_lookups.get('uplink', []), 300)
        })

    supa_id = monitors.get('supabase', '1')
    vapi_id = monitors.get('vercel_api', '3')
    up_id = monitors.get('uplink', '7')

    result = {
        'status': 'up',
        'monitors_total': len(hb),
        'monitors_up': sum(1 for v in hb.values() if v and v[-1].get('status') == 1),
        'monitors_down': sum(1 for v in hb.values() if v and v[-1].get('status') == 0),
        'uptime_24h_percent': round(sum(uptime.values()) / max(1, len(uptime)) * 100, 1),
        'supabase_db_ping_ms': hb.get(supa_id, [{}])[-1].get('ping'),
        'vercel_api_ping_ms': hb.get(vapi_id, [{}])[-1].get('ping'),
        'internet_uplink_ping_ms': hb.get(up_id, [{}])[-1].get('ping'),
        'failed_events': failed_events[-10:],
        'series': series
    }
    print(json.dumps(result))
except Exception:
    pass
EOF
)
    if [[ -n "${PY_KUMA}" ]]; then
        KUMA_STATUS="up"
        KUMA_TELEMETRY="${PY_KUMA}"
    fi
fi

# Fallback probe if Python extraction was empty
if [[ "${KUMA_STATUS}" == "down" ]]; then
    HTTP_KUMA=$(curl -s -m 2 -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/ 2>/dev/null || true)
    if [[ "${HTTP_KUMA}" =~ ^(200|302|401)$ ]]; then
        KUMA_STATUS="up"
        KUMA_TELEMETRY='{"status":"up"}'
    fi
fi

# 4.1 Harvest BugSink telemetry (SQLite database on on-premise node)
BUGSINK_TELEMETRY='{"status":"unavailable"}'
BUGSINK_DB_PATH="/srv/elitedesk_team_ops/bugsink/data/db.sqlite3"

if command -v python3 >/dev/null 2>&1; then
    PY_BUGSINK=$(python3 - << 'EOF' 2>/dev/null || true
import sqlite3
import json
import os

db_path = "/srv/elitedesk_team_ops/bugsink/data/db.sqlite3"
result = {"status": "unavailable"}

if os.path.isfile(db_path):
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cur = conn.cursor()

        cur.execute("SELECT count(*) FROM issues_issue")
        total_issues = cur.fetchone()[0]

        cur.execute("SELECT count(*) FROM events_event")
        total_events = cur.fetchone()[0]

        cur.execute("PRAGMA table_info(issues_issue)")
        cols = [r[1] for r in cur.fetchall()]
        type_col = "calculated_type" if "calculated_type" in cols else ("type" if "type" in cols else "id")
        val_col = "calculated_value" if "calculated_value" in cols else ("value" if "value" in cols else "id")
        order_col = "last_seen" if "last_seen" in cols else "id"

        cur.execute(f"SELECT id, {type_col}, {val_col}, {order_col} FROM issues_issue ORDER BY {order_col} DESC LIMIT 3")
        recent = []
        for r in cur.fetchall():
            raw_id = str(r[0])
            if len(raw_id) == 32:
                hyphen_id = f"{raw_id[:8]}-{raw_id[8:12]}-{raw_id[12:16]}-{raw_id[16:20]}-{raw_id[20:]}"
            else:
                hyphen_id = raw_id
            recent.append({
                "id": hyphen_id,
                "type": str(r[1] or "UnknownError"),
                "value": str(r[2] or "")[:120],
                "last_seen": str(r[3] or "")
            })

        result = {
            "status": "ok",
            "total_issues": total_issues,
            "total_events": total_events,
            "recent_issues": recent
        }
        conn.close()
    except Exception:
        pass

print(json.dumps(result))
EOF
)
    if [[ -n "${PY_BUGSINK}" ]]; then
        BUGSINK_TELEMETRY="${PY_BUGSINK}"
    fi
fi

ISO_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 5. Assemble JSON payload
PAYLOAD=$(cat <<EOF
{
  "node": "${DMS_NODE_ID}",
  "uptime_kuma": "${KUMA_STATUS}",
  "load_avg": ${LOAD_AVG:-0.0},
  "memory_used_mb": ${MEM_USED:-0},
  "memory_total_mb": ${MEM_TOTAL:-0},
  "uptime_sec": ${UPTIME_SEC:-0},
  "timestamp": "${ISO_TIMESTAMP}",
  "kuma": ${KUMA_TELEMETRY},
  "bugsink": ${BUGSINK_TELEMETRY}
}
EOF
)

# 6. Dispatch HTTP POST to Cloudflare Worker Edge
HTTP_RESPONSE=$(curl -s -S -m 10 -w "\n%{http_code}" -X POST "${DMS_ENDPOINT}" \
    -H "Authorization: Bearer ${DMS_SECRET_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" 2>&1 || true)

HTTP_CODE=$(echo "${HTTP_RESPONSE}" | tail -n 1)
HTTP_BODY=$(echo "${HTTP_RESPONSE}" | sed '$d')

if [[ "${HTTP_CODE}" == "200" ]]; then
    echo "[OK] [${ISO_TIMESTAMP}] DMS check-in accepted (HTTP 200). Node: ${DMS_NODE_ID}, Load: ${LOAD_AVG}, Mem: ${MEM_USED}/${MEM_TOTAL}MB, Kuma: ${KUMA_STATUS}"
    exit 0
else
    echo "[FAIL] [${ISO_TIMESTAMP}] DMS check-in rejected (HTTP ${HTTP_CODE}). Body: ${HTTP_BODY}" >&2
    exit 1
fi
