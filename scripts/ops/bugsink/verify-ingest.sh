#!/usr/bin/env bash
# ==============================================================================
# Script: verify-ingest.sh
# Purpose: End-to-end verification of error ingest into Bugsink
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_FILE="${SCRIPT_DIR}/data/db.sqlite3"
DSN_FILE="${SCRIPT_DIR}/data/dsn.txt"

echo "=== Bugsink Error Ingest Verification ==="

if [[ ! -f "${DB_FILE}" ]]; then
    echo "[ERROR] Database file not found: ${DB_FILE}"
    exit 1
fi

python3 - <<EOF
import sqlite3
import sys

conn = sqlite3.connect("${DB_FILE}")
cursor = conn.cursor()

print("[INFO] Querying Bugsink database stats...")

try:
    cursor.execute("SELECT count(*) FROM projects_project")
    proj_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT count(*) FROM issues_issue")
    issue_count = cursor.fetchone()[0]
    
    cursor.execute("SELECT count(*) FROM events_event")
    event_count = cursor.fetchone()[0]
    
    print(f"Projects count: {proj_count}")
    print(f"Issues count:   {issue_count}")
    print(f"Events count:   {event_count}")
    
    if issue_count > 0:
        print("\nRecent Ingested Issues:")
        cursor.execute("SELECT id, calculated_type, calculated_value, first_seen, digested_event_count FROM issues_issue ORDER BY id DESC LIMIT 5")
        for row in cursor.fetchall():
            print(f" - [ID: {row[0]}] {row[1]}: {row[2]} (First Seen: {row[3]}, Events: {row[4]})")
    else:
        print("\n[INFO] No issues ingested yet. Send a mock error from Next.js to populate.")
except Exception as e:
    print(f"[WARN] Error reading stats: {e}")
finally:
    conn.close()
EOF
