#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/pack-dms-to-ikari.sh
# Purpose: Top-level wrapper to package Dead Man's Switch (DMS) for service account ikari
# Usage: sudo ./scripts/pack-dms-to-ikari.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/ops/dms/pack-for-ikari.sh" "$@"
