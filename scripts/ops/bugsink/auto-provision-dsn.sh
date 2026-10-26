#!/usr/bin/env bash
# ==============================================================================
# Script: auto-provision-dsn.sh
# Purpose: Auto-provision default Project in Bugsink and export DSN
# Engine: Direct SQLite inspection (Rootless cgroups safe)
# Target: Ops User 'ikari' on HP Node
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DSN_FILE="${SCRIPT_DIR}/data/dsn.txt"
DB_FILE="${SCRIPT_DIR}/data/db.sqlite3"
ENV_FILE="${SCRIPT_DIR}/.env"

PORT="35800"
if [[ -f "${ENV_FILE}" ]]; then
    PORT_VAL=$(grep "^BUGSINK_PORT=" "${ENV_FILE}" | cut -d= -f2 || true)
    if [[ -n "${PORT_VAL}" ]]; then
        PORT="${PORT_VAL}"
    fi
fi

echo "=== Auto-Provisioning Bugsink Default Project ==="

# Read key from SQLite database directly
PROJECT_INFO=$(python3 -c "
import sqlite3, sys
try:
    con = sqlite3.connect('${DB_FILE}')
    cur = con.cursor()
    row = cur.execute('SELECT id, sentry_key FROM projects_project WHERE slug=\"cloudstock-nextjs\"').fetchone()
    if not row:
        row = cur.execute('SELECT id, sentry_key FROM projects_project ORDER BY id ASC LIMIT 1').fetchone()
    if row:
        print(f'{row[0]}:{row[1]}')
except Exception as e:
    sys.exit(1)
" 2>/dev/null || true)

if [[ -z "${PROJECT_INFO}" ]]; then
    # Try via docker exec if cgroups allow
    PROJECT_INFO=$(docker exec -i ops_bugsink bugsink-manage shell -c '
from projects.models import Project
p = Project.objects.filter(slug="cloudstock-nextjs").first() or Project.objects.first()
if p:
    print(f"{p.id}:{p.sentry_key}")
' 2>/dev/null | grep -E '^[0-9]+:[a-f0-9]+' || true)
fi

if [[ -n "${PROJECT_INFO}" ]]; then
    PID=$(echo "${PROJECT_INFO}" | cut -d: -f1)
    SENTRY_KEY=$(echo "${PROJECT_INFO}" | cut -d: -f2)
    DSN_URL="http://${SENTRY_KEY}@127.0.0.1:${PORT}/${PID}"
    TAILSCALE_DSN_URL="http://${SENTRY_KEY}@100.103.109.18:${PORT}/${PID}"
    
    mkdir -p "${SCRIPT_DIR}/data"
    echo "${DSN_URL}" > "${DSN_FILE}"
    chmod 666 "${DSN_FILE}" 2>/dev/null || true
    
    echo ""
    echo "=================================================================="
    echo "             BUGSINK DSN PROVISIONED SUCCESSFULLY                 "
    echo "=================================================================="
    echo "Local Ingest DSN:     ${DSN_URL}"
    echo "Tailscale Ingest DSN: ${TAILSCALE_DSN_URL}"
    echo "Persisted at:         ${DSN_FILE}"
    echo "=================================================================="
    echo "To link this to your Next.js application, add this to .env.local:"
    echo "NEXT_PUBLIC_BUGSINK_DSN=${DSN_URL}"
    echo "BUGSINK_DSN=${DSN_URL}"
    echo "=================================================================="
else
    echo "[WARN] Project record not found in database yet. Bugsink may still be bootstrapping."
fi
