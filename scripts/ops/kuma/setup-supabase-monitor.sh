#!/usr/bin/env bash
# ==============================================================================
# Script: setup-supabase-monitor.sh
# Purpose: Generate and configure dual-layer Supabase Keep-Alive monitors for Uptime Kuma
# Target: Ops User 'ikari' on HP Node
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.local"
CONFIG_OUTPUT="${SCRIPT_DIR}/supabase-monitors-spec.json"

echo "=== Supabase Keep-Alive Configuration Generator ==="

# Read environment variables safely
SUPABASE_URL=""
DATABASE_URL=""
ANON_KEY=""

if [[ -f "${ENV_FILE}" ]]; then
    echo "[INFO] Reading configuration from ${ENV_FILE}..."
    SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    DATABASE_URL=$(grep "^DATABASE_URL=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    ANON_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "${ENV_FILE}" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
else
    echo "[WARN] .env.local not found at project root. Using placeholder / environment."
fi

# Fallback or overrides from environment
SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-https://your-project.supabase.co}}"
DATABASE_URL="${DATABASE_URL:-${DATABASE_URL:-}}"

# Parse Postgres connection string details if present
# Format: postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB>?...
PG_HOST="aws-0-ap-northeast-1.pooler.supabase.com"
PG_PORT="6543"
PG_USER="postgres.your-project-ref"
PG_DB="postgres"

if [[ -n "${DATABASE_URL}" && "${DATABASE_URL}" =~ postgresql:\/\/([^:]+):([^@]+)@([^:]+):([0-9]+)\/([^?]+) ]]; then
    PG_USER="${BASH_REMATCH[1]}"
    # Masked password extraction for spec sheet
    PG_HOST="${BASH_REMATCH[3]}"
    PG_PORT="${BASH_REMATCH[4]}"
    PG_DB="${BASH_REMATCH[5]}"
    echo "[OK] Successfully parsed PostgreSQL credentials from DATABASE_URL."
fi

# Output JSON Spec for Uptime Kuma
cat <<EOF > "${CONFIG_OUTPUT}"
{
  "description": "Supabase Dual-Layer Keep-Alive Monitor Specification",
  "version": "1.0",
  "generated_at": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "monitors": [
    {
      "name": "Supabase Postgres Pooler Keep-Alive",
      "type": "postgres",
      "hostname": "${PG_HOST}",
      "port": ${PG_PORT},
      "database": "${PG_DB}",
      "username": "${PG_USER}",
      "interval_seconds": 300,
      "retry_interval_seconds": 60,
      "max_retries": 3,
      "description": "Direct PostgreSQL connection executing 'SELECT 1;' to keep Supabase DB active and avoid the 7-day inactivity pause.",
      "note": "Enter your DB password when configuring in Uptime Kuma UI."
    },
    {
      "name": "App Production Health & Supabase Ping",
      "type": "http",
      "url": "https://<YOUR_DEPLOYED_APP_DOMAIN>/api/health",
      "fallback_local_url": "http://127.0.0.1:3000/api/health",
      "method": "GET",
      "interval_seconds": 120,
      "retry_interval_seconds": 30,
      "max_retries": 2,
      "accepted_statuscodes": ["200"],
      "description": "HTTP ping to Next.js /api/health handler which actively queries Supabase PostgREST gateway."
    }
  ]
}
EOF

echo "[OK] Monitor specifications written to: ${CONFIG_OUTPUT}"
echo ""
echo "================================================================================"
echo "  MONITOR SETUP GUIDE FOR UPTIME KUMA (UI: http://100.103.109.18:3001)"
echo "================================================================================"
echo "1. Monitor #1: Supabase Direct Database Ping (Highest Priority Keep-Alive)"
echo "   - Monitor Type     : PostgreSQL"
echo "   - Friendly Name    : Supabase DB Keep-Alive (aws-ap-northeast-1)"
echo "   - Hostname / IP    : ${PG_HOST}"
echo "   - Port             : ${PG_PORT}"
echo "   - Database         : ${PG_DB}"
echo "   - Username         : ${PG_USER}"
echo "   - Password         : [Your Supabase database password]"
echo "   - Heartbeat Interval: 300 seconds (5 minutes)"
echo "   - Retries          : 3"
echo ""
echo "2. Monitor #2: Web App Route Keep-Alive"
echo "   - Monitor Type     : HTTP(s)"
echo "   - Friendly Name    : App Health & DB Ping"
echo "   - URL              : https://<your-domain>/api/health (or http://localhost:3000/api/health)"
echo "   - Heartbeat Interval: 120 seconds (2 minutes)"
echo "================================================================================"
