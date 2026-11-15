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

    # 2. Extract Downsampled Time-Series (~20 points over 8h)
    m1_points = hb.get('1', [])
    total_pts = len(m1_points)
    step = max(1, total_pts // 20)
    indices = list(range(0, total_pts, step))
    if total_pts > 0 and indices[-1] != total_pts - 1:
        indices.append(total_pts - 1)

    series = []
    for idx in indices:
        p1 = m1_points[idx] if idx < len(m1_points) else {}
        raw_time = p1.get('time', '')
        short_time = raw_time[11:16] if len(raw_time) >= 16 else f'P{idx}'
        p3 = hb.get('3', [])[idx] if idx < len(hb.get('3', [])) else {}
        p4 = hb.get('4', [])[idx] if idx < len(hb.get('4', [])) else {}
        p7 = hb.get('7', [])[idx] if idx < len(hb.get('7', [])) else {}
        series.append({
            'time': short_time,
            'supabase_ping': p1.get('ping'),
            'vercel_health_ping': p3.get('ping'),
            'vercel_front_ping': p4.get('ping'),
            'uplink_ping': p7.get('ping')
        })

    result = {
        'status': 'up',
        'monitors_total': len(hb),
        'monitors_up': sum(1 for v in hb.values() if v and v[-1].get('status') == 1),
        'monitors_down': sum(1 for v in hb.values() if v and v[-1].get('status') == 0),
        'uptime_24h_percent': round(sum(uptime.values()) / max(1, len(uptime)) * 100, 1),
        'supabase_db_ping_ms': hb.get('1', [{}])[-1].get('ping'),
        'vercel_api_ping_ms': hb.get('3', [{}])[-1].get('ping'),
        'internet_uplink_ping_ms': hb.get('7', [{}])[-1].get('ping'),
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

        cur.execute(f"SELECT id, {type_col}, {val_col} FROM issues_issue ORDER BY id DESC LIMIT 3")
        recent = []
        for r in cur.fetchall():
            recent.append({
                "id": r[0],
                "type": str(r[1] or "UnknownError"),
                "value": str(r[2] or "")[:120]
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
