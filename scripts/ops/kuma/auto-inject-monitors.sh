#!/usr/bin/env bash
# ==============================================================================
# Script: auto-inject-monitors.sh
# Purpose: Directly inject Supabase Keep-Alive monitors into Uptime Kuma SQLite DB
# Engine: Native Python 3 SQLite (bypasses Docker exec cgroup limitations)
# Target: Ops User 'ikari' on HP Node
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="${SCRIPT_DIR}/data/kuma.db"
CONTAINER_NAME="ops_uptime_kuma"

echo "=== Auto-Injecting Supabase Monitors via Host Python 3 SQLite ==="

if [[ ! -f "${DB_FILE}" ]]; then
    echo "[ERROR] Database file not found at: ${DB_FILE}"
    echo "        Make sure Uptime Kuma has run at least once."
    exit 1
fi

echo "[INFO] Interacting directly with database: ${DB_FILE}"

# Execute Python 3 SQLite script directly on host
python3 - <<'EOF'
import sqlite3
import os
import sys

db_file = os.path.join(os.getcwd(), 'data', 'kuma.db')
if not os.path.exists(db_file):
    print(f"[ERROR] {db_file} does not exist.")
    sys.exit(1)

conn = sqlite3.connect(db_file)
cursor = conn.cursor()

# Get user_id if present
user_id = None
try:
    cursor.execute("SELECT id FROM user LIMIT 1")
    row = cursor.fetchone()
    if row:
        user_id = row[0]
        print(f"[INFO] Found admin user ID: {user_id}")
except Exception:
    pass

# Inspect monitor table columns
cursor.execute("PRAGMA table_info(monitor)")
cols_info = cursor.fetchall()
columns = [c[1] for c in cols_info]

db_conn_str = "postgresql://postgres.gsejxaasdujmqveshqyf:wbIW2sVPL071GlLg@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
health_url = "http://127.0.0.1:3000/api/health"

# 1. Supabase Postgres Monitor
cursor.execute("SELECT id FROM monitor WHERE name = 'Supabase DB Keep-Alive'")
existing_pg = cursor.fetchone()

if existing_pg:
    print(f"[INFO] Postgres monitor already exists (ID: {existing_pg[0]}). Updating...")
    cursor.execute("""
        UPDATE monitor 
        SET active = 1, interval = 300, database_connection_string = ?, database_query = 'SELECT 1;'
        WHERE id = ?
    """, (db_conn_str, existing_pg[0]))
    print("[OK] Updated Supabase DB Keep-Alive monitor.")
else:
    insert_cols = ['name', 'type', 'active', 'interval', 'retry_interval', 'maxretries']
    values = ['Supabase DB Keep-Alive', 'postgres', 1, 300, 60, 3]

    if 'user_id' in columns and user_id:
        insert_cols.append('user_id')
        values.append(user_id)
    if 'database_connection_string' in columns:
        insert_cols.append('database_connection_string')
        values.append(db_conn_str)
    if 'database_query' in columns:
        insert_cols.append('database_query')
        values.append('SELECT 1;')

    placeholders = ', '.join(['?'] * len(values))
    sql = f"INSERT INTO monitor ({', '.join(insert_cols)}) VALUES ({placeholders})"
    cursor.execute(sql, values)
    print(f"[OK] Injected 'Supabase DB Keep-Alive' monitor (ID: {cursor.lastrowid}).")

# 2. Next.js App Health Monitor
cursor.execute("SELECT id FROM monitor WHERE name = 'Next.js App Health'")
existing_http = cursor.fetchone()

if existing_http:
    print(f"[INFO] HTTP health monitor already exists (ID: {existing_http[0]}).")
else:
    insert_cols = ['name', 'type', 'active', 'interval', 'retry_interval', 'maxretries', 'url']
    values = ['Next.js App Health', 'http', 1, 120, 30, 2, health_url]

    if 'user_id' in columns and user_id:
        insert_cols.append('user_id')
        values.append(user_id)
    if 'method' in columns:
        insert_cols.append('method')
        values.append('GET')
    if 'accepted_statuscodes_json' in columns:
        insert_cols.append('accepted_statuscodes_json')
        values.append('["200-299"]')

    placeholders = ', '.join(['?'] * len(values))
    sql = f"INSERT INTO monitor ({', '.join(insert_cols)}) VALUES ({placeholders})"
    cursor.execute(sql, values)
    print(f"[OK] Injected 'Next.js App Health' monitor (ID: {cursor.lastrowid}).")

conn.commit()
conn.close()
print("[SUCCESS] All monitors saved successfully to kuma.db.")
EOF

echo "[INFO] Restarting container to apply newly injected monitors..."
docker restart "${CONTAINER_NAME}"
echo "[OK] Container restarted successfully."
echo "[OK] Access http://100.103.109.18:3001/dashboard to view active heartbeats!"
