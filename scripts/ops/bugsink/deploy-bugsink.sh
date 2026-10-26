#!/usr/bin/env bash
# ==============================================================================
# Script: deploy-bugsink.sh
# Purpose: Deploy Bugsink Error Sink for Ops User 'ikari' on HP EliteDesk Node
# Target User: ikari (UID 1002)
# ==============================================================================

set -euo pipefail

CURRENT_UID=$(id -u)
CURRENT_USER=$(id -un)
REQUIRED_USER="ikari"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${SCRIPT_DIR}/data"
ENV_FILE="${SCRIPT_DIR}/.env"

echo "[INFO] Running deployment check for Bugsink on HP Node..."
echo "[INFO] Current executing user: ${CURRENT_USER} (UID: ${CURRENT_UID})"

# User Verification Guard
if [[ "${CURRENT_USER}" != "${REQUIRED_USER}" && "${CURRENT_UID}" -ne 0 ]]; then
    echo "[WARN] Notice: Target operational user is '${REQUIRED_USER}'."
    echo "[WARN] If running as 'gawasyu', switch to '${REQUIRED_USER}' or execute via:"
    echo "       sudo -u ${REQUIRED_USER} -i bash ${SCRIPT_DIR}/deploy-bugsink.sh"
    echo ""
fi

# Detect Docker Socket (Rootless vs Root)
if [[ -S "/run/user/${CURRENT_UID}/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/${CURRENT_UID}"
    export DOCKER_HOST="unix:///run/user/${CURRENT_UID}/docker.sock"
    echo "[INFO] Using active rootless Docker socket: ${DOCKER_HOST}"
elif [[ "${CURRENT_USER}" == "${REQUIRED_USER}" && -S "/run/user/1002/docker.sock" ]]; then
    export XDG_RUNTIME_DIR="/run/user/1002"
    export DOCKER_HOST="unix:///run/user/1002/docker.sock"
    echo "[INFO] Using user 1002 Docker socket: ${DOCKER_HOST}"
elif [[ -S "/var/run/docker.sock" ]]; then
    echo "[INFO] Using system Docker socket: /var/run/docker.sock"
else
    echo "[ERROR] Docker socket not found. Ensure rootless dockerd is running for ${CURRENT_USER}."
    echo "        Check with: systemctl --user status docker"
    exit 1
fi

# Validate Docker CLI availability
if ! command -v docker >/dev/null 2>&1; then
    echo "[ERROR] 'docker' binary not found in PATH."
    exit 1
fi

# Prepare persistent data directory with permissive write for in-container bugsink user (UID 14237)
if [[ ! -d "${DATA_DIR}" ]]; then
    echo "[INFO] Creating persistent data directory at: ${DATA_DIR}"
    mkdir -p "${DATA_DIR}"
    chmod 777 "${DATA_DIR}"
else
    chmod 777 "${DATA_DIR}"
fi

# Generate local service .env if missing
if [[ ! -f "${ENV_FILE}" ]]; then
    echo "[INFO] Generating random secret key in: ${ENV_FILE}"
    SECRET_KEY_GEN=$(openssl rand -hex 32)
    cat <<EOF > "${ENV_FILE}"
BUGSINK_PORT=35800
BUGSINK_TAILSCALE_IP=100.103.109.18
BUGSINK_SECRET_KEY=${SECRET_KEY_GEN}
BUGSINK_SUPERUSER=admin@cloudstock.local:CloudStockOps2026!
BUGSINK_BASE_URL=http://127.0.0.1:35800
BUGSINK_ALLOWED_HOSTS=127.0.0.1,localhost,100.103.109.18
EOF
    chmod 600 "${ENV_FILE}"
fi

# shellcheck source=/dev/null
source "${ENV_FILE}"

cd "${SCRIPT_DIR}"
CONTAINER_NAME="ops_bugsink"
PORT="${BUGSINK_PORT:-35800}"

echo "[INFO] Target address: http://127.0.0.1:${PORT} and http://${BUGSINK_TAILSCALE_IP:-100.103.109.18}:${PORT}"

# Check port conflict before launching
if ss -tuln | grep -q ":${PORT} "; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "[INFO] Container '${CONTAINER_NAME}' is already running on port ${PORT}."
        docker ps --filter "name=${CONTAINER_NAME}"
    else
        echo "[WARN] Port ${PORT} is occupied by another process. Check with: ss -tulpn | grep :${PORT}"
    fi
fi

echo "[INFO] Pulling bugsink/bugsink:2 image..."
docker pull bugsink/bugsink:2

echo "[INFO] Starting Bugsink container..."
docker compose down 2>/dev/null || true
docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true

if docker compose version >/dev/null 2>&1; then
    docker compose up -d
elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d
else
    echo "[ERROR] Docker compose not found."
    exit 1
fi

# Verification & Readiness Polling
echo "[INFO] Polling Bugsink readiness endpoint (up to 40s)..."
READY=0
for i in {1..20}; do
    if curl -s -f "http://127.0.0.1:${PORT}/health/ready" >/dev/null 2>&1; then
        echo "[OK] Bugsink is healthy and ready! (iteration ${i})"
        READY=1
        break
    fi
    echo "[INFO] Waiting for Bugsink to complete migrations and startup (${i}/20)..."
    sleep 2
done

if [[ "${READY}" -ne 1 ]]; then
    echo "[ERROR] Bugsink failed to report ready within timeout. Checking container logs:"
    docker logs --tail 50 "${CONTAINER_NAME}"
    exit 1
fi

# Ensure database file is writable by host tools for automated provisioning
docker exec "${CONTAINER_NAME}" chmod 666 /data/db.sqlite3 2>/dev/null || chmod 666 "${DATA_DIR}"/db.sqlite3* 2>/dev/null || true

# Run auto-provision-dsn.sh to provision default project and export DSN
if [[ -f "${SCRIPT_DIR}/auto-provision-dsn.sh" ]]; then
    echo "[INFO] Running auto-provision-dsn.sh..."
    bash "${SCRIPT_DIR}/auto-provision-dsn.sh"
fi

echo "=== Deployment Succeeded ==="
docker ps --filter "name=${CONTAINER_NAME}"
