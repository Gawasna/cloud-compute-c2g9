#!/usr/bin/env bash
# ==============================================================================
# Script: scripts/maintenance/check_ikari_setup.sh
# Purpose: Comprehensive infrastructure audit for user 'ikari' on HP Node
# Requires: sudo privileges (UID 0)
# ==============================================================================

set -u

TARGET_USER="ikari"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT_DIR="${CURRENT_DIR}"

# ANSI color codes
CLR_RESET="\033[0m"
CLR_BOLD="\033[1m"
CLR_RED="\033[31m"
CLR_GREEN="\033[32m"
CLR_YELLOW="\033[33m"
CLR_BLUE="\033[34m"
CLR_CYAN="\033[36m"

print_header() {
    echo -e "\n${CLR_BOLD}${CLR_BLUE}=== $1 ===${CLR_RESET}"
}

print_ok() {
    echo -e " [${CLR_GREEN}OK${CLR_RESET}] $1"
}

print_warn() {
    echo -e " [${CLR_YELLOW}WARN${CLR_RESET}] $1"
}

print_fail() {
    echo -e " [${CLR_RED}FAIL${CLR_RESET}] $1"
}

print_info() {
    echo -e " [${CLR_CYAN}INFO${CLR_RESET}] $1"
}

# Gate check: Ensure root / sudo execution
if [[ "${EUID}" -ne 0 ]]; then
    echo -e "${CLR_RED}Error: This diagnostic script requires sudo privileges.${CLR_RESET}"
    echo "Usage: sudo bash $0"
    exit 1
fi

echo "======================================================================"
echo "  AUDIT REPORT: User '${TARGET_USER}' Infrastructure Setup"
echo "  Timestamp : $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "  Host      : $(hostname) ($(uname -s -r -m))"
echo "  Target UID: $(id -u "${TARGET_USER}" 2>/dev/null || echo 'NOT FOUND')"
echo "======================================================================"

# ------------------------------------------------------------------------------
# 1. User Account & Security Status
# ------------------------------------------------------------------------------
print_header "1. User Account & Security Status"

if ! id "${TARGET_USER}" >/dev/null 2>&1; then
    print_fail "User '${TARGET_USER}' does not exist on this system."
    exit 1
fi

TARGET_UID=$(id -u "${TARGET_USER}")
TARGET_GID=$(id -g "${TARGET_USER}")
TARGET_GROUPS=$(id -Gn "${TARGET_USER}")
TARGET_HOME=$(getent passwd "${TARGET_USER}" | cut -d: -f6)
TARGET_SHELL=$(getent passwd "${TARGET_USER}" | cut -d: -f7)

print_info "UID: ${TARGET_UID}, Primary GID: ${TARGET_GID}"
print_info "Groups: ${TARGET_GROUPS}"
print_info "Home directory: ${TARGET_HOME}"
print_info "Default shell: ${TARGET_SHELL}"

# Account password and lock status
PASSWD_STATUS=$(passwd -S "${TARGET_USER}" 2>/dev/null | awk '{print $2}')
case "${PASSWD_STATUS}" in
    P) print_ok "Password status: Active (Password set)" ;;
    L) print_warn "Password status: Locked (Account password is locked)" ;;
    NP) print_warn "Password status: No password set" ;;
    *) print_info "Password status code: ${PASSWD_STATUS}" ;;
esac

# Account expiration details
CHAGE_INFO=$(chage -l "${TARGET_USER}" 2>/dev/null | grep -E "Account expires|Password expires" || true)
echo "${CHAGE_INFO}" | while read -r line; do
    print_info "${line}"
done

# Home directory permissions
if [[ -d "${TARGET_HOME}" ]]; then
    HOME_PERMS=$(stat -c "%a (%A) Owner: %U:%G" "${TARGET_HOME}")
    print_info "Home permissions: ${HOME_PERMS}"
else
    print_fail "Home directory '${TARGET_HOME}' does not exist."
fi

# ------------------------------------------------------------------------------
# 2. Sudo Privileges & Policy Restrictions
# ------------------------------------------------------------------------------
print_header "2. Sudo Privileges & Policy Restrictions"

SUDO_POLICY_FILE="/etc/sudoers.d/zz-ikari-deny"
if [[ -f "${SUDO_POLICY_FILE}" ]]; then
    print_warn "Found explicit sudo policy file: ${SUDO_POLICY_FILE}"
    echo "------------------ File Content ------------------"
    cat "${SUDO_POLICY_FILE}"
    echo "--------------------------------------------------"
else
    print_info "No specific file found at ${SUDO_POLICY_FILE}."
fi

# Check effective sudo permissions for target user
print_info "Evaluating effective 'sudo -l -U ${TARGET_USER}':"
sudo -l -U "${TARGET_USER}" 2>&1 | while read -r line; do
    echo "    ${line}"
done

# ------------------------------------------------------------------------------
# 3. Workspace & File System Access Permissions
# ------------------------------------------------------------------------------
print_header "3. Workspace & File System Access"

# Check parent directory access
PARENT_DIR="$(dirname "${PROJECT_DIR}")"
GRANDPARENT_DIR="$(dirname "${PARENT_DIR}")"

print_info "Checking access traversal from root down to project directory:"
echo "    Path: ${PROJECT_DIR}"

can_traverse=true
for check_path in "${GRANDPARENT_DIR}" "${PARENT_DIR}" "${PROJECT_DIR}"; do
    stat_info=$(stat -c "%a %U:%G" "${check_path}" 2>/dev/null || echo "UNKNOWN")
    if sudo -u "${TARGET_USER}" test -x "${check_path}" 2>/dev/null; then
        print_ok "Traversal permitted on: ${check_path} [perms: ${stat_info}]"
    else
        print_fail "Traversal BLOCKED on: ${check_path} [perms: ${stat_info}]"
        can_traverse=false
    fi
done

if sudo -u "${TARGET_USER}" test -r "${PROJECT_DIR}" 2>/dev/null; then
    print_ok "'${TARGET_USER}' has READ access to project directory"
else
    print_fail "'${TARGET_USER}' CANNOT read project directory"
fi

if sudo -u "${TARGET_USER}" test -w "${PROJECT_DIR}" 2>/dev/null; then
    print_ok "'${TARGET_USER}' has WRITE access to project directory"
else
    print_warn "'${TARGET_USER}' has NO WRITE access to current project directory"
fi

# Check shared ops directory
SHARED_OPS_DIR="/srv/elitedesk_team_ops"
print_info "Checking shared ops directory: ${SHARED_OPS_DIR}"
if [[ -d "${SHARED_OPS_DIR}" ]]; then
    OPS_PERMS=$(stat -c "%a (%A) Owner: %U:%G" "${SHARED_OPS_DIR}")
    print_ok "Directory exists with perms: ${OPS_PERMS}"
    echo "------------------ Content in ${SHARED_OPS_DIR} ------------------"
    ls -la "${SHARED_OPS_DIR}"
    echo "-----------------------------------------------------------------"
else
    print_warn "Shared directory ${SHARED_OPS_DIR} does not exist."
fi

# Check home directory contents & SSH
print_info "Checking ${TARGET_HOME} workspace contents:"
ls -la "${TARGET_HOME}"

SSH_DIR="${TARGET_HOME}/.ssh"
if [[ -d "${SSH_DIR}" ]]; then
    print_info "SSH directory located: ${SSH_DIR}"
    ls -la "${SSH_DIR}"
else
    print_warn "No .ssh directory located in ${TARGET_HOME}"
fi

# ------------------------------------------------------------------------------
# 4. Node.js & Runtime Tooling Environment
# ------------------------------------------------------------------------------
print_header "4. Node.js & Runtime Tooling Environment"

print_info "Checking binaries in '${TARGET_USER}' login environment:"

run_as_target() {
    sudo -u "${TARGET_USER}" -i bash -c "$1" 2>&1
}

TARGET_NODE=$(run_as_target "which node" || true)
TARGET_NPM=$(run_as_target "which npm" || true)
TARGET_PNPM=$(run_as_target "which pnpm" || true)
TARGET_YARN=$(run_as_target "which yarn" || true)
TARGET_GIT=$(run_as_target "which git" || true)

if [[ -n "${TARGET_NODE}" ]]; then
    NODE_VER=$(run_as_target "node -v")
    print_ok "Node.js detected: ${TARGET_NODE} (version: ${NODE_VER})"
else
    print_fail "Node.js NOT found in PATH for '${TARGET_USER}'"
fi

if [[ -n "${TARGET_NPM}" ]]; then
    NPM_VER=$(run_as_target "npm -v")
    print_ok "npm detected: ${TARGET_NPM} (version: ${NPM_VER})"
else
    print_fail "npm NOT found in PATH for '${TARGET_USER}'"
fi

[[ -n "${TARGET_GIT}" ]] && print_ok "git detected: ${TARGET_GIT}" || print_fail "git not found"

# Check NVM in target home
if [[ -d "${TARGET_HOME}/.nvm" ]]; then
    print_ok "NVM installation directory found at ${TARGET_HOME}/.nvm"
    run_as_target "source ${TARGET_HOME}/.nvm/nvm.sh 2>/dev/null && nvm ls" | while read -r line; do
        echo "    ${line}"
    done
else
    print_warn "No .nvm directory in ${TARGET_HOME}"
fi

# Git identity configuration
print_info "Git config for '${TARGET_USER}':"
GIT_NAME=$(sudo -u "${TARGET_USER}" git config --global user.name 2>/dev/null || true)
GIT_EMAIL=$(sudo -u "${TARGET_USER}" git config --global user.email 2>/dev/null || true)
print_info "user.name  : ${GIT_NAME:-[UNSET]}"
print_info "user.email : ${GIT_EMAIL:-[UNSET]}"

# ------------------------------------------------------------------------------
# 5. Docker & Rootless Container Status
# ------------------------------------------------------------------------------
print_header "5. Docker & Container Infrastructure"

# Check group membership
if [[ " ${TARGET_GROUPS} " =~ " docker " ]]; then
    print_ok "'${TARGET_USER}' is a member of the 'docker' system group"
else
    print_info "'${TARGET_USER}' is NOT in 'docker' system group (Common for Rootless setup)"
fi

# Check subuid / subgid
SUBUID_ENTRY=$(grep "^${TARGET_USER}:" /etc/subuid 2>/dev/null || true)
SUBGID_ENTRY=$(grep "^${TARGET_USER}:" /etc/subgid 2>/dev/null || true)

if [[ -n "${SUBUID_ENTRY}" && -n "${SUBGID_ENTRY}" ]]; then
    print_ok "Rootless subuid/subgid mapping configured: ${SUBUID_ENTRY}"
else
    print_fail "Missing /etc/subuid or /etc/subgid mapping for '${TARGET_USER}'"
fi

# Check Rootless Dockerd Process
ROOTLESS_PID=$(pgrep -u "${TARGET_USER}" -f "dockerd-rootless" || true)
if [[ -n "${ROOTLESS_PID}" ]]; then
    print_ok "Rootless dockerd daemon running (PID: ${ROOTLESS_PID})"
else
    print_warn "Rootless dockerd daemon NOT detected running"
fi

# Check Rootless Docker Socket
ROOTLESS_SOCK="/run/user/${TARGET_UID}/docker.sock"
if [[ -S "${ROOTLESS_SOCK}" ]]; then
    print_ok "Rootless Docker socket active: ${ROOTLESS_SOCK}"
    echo "------------------ Active Containers (Rootless) ------------------"
    sudo -u "${TARGET_USER}" XDG_RUNTIME_DIR="/run/user/${TARGET_UID}" DOCKER_HOST="unix://${ROOTLESS_SOCK}" docker ps -a 2>&1 || true
    echo "------------------ Docker Images (Rootless) ----------------------"
    sudo -u "${TARGET_USER}" XDG_RUNTIME_DIR="/run/user/${TARGET_UID}" DOCKER_HOST="unix://${ROOTLESS_SOCK}" docker images 2>&1 || true
    echo "------------------------------------------------------------------"
else
    print_warn "Docker socket ${ROOTLESS_SOCK} not active or not a socket"
fi

# ------------------------------------------------------------------------------
# 6. Systemd User Units & Background Services
# ------------------------------------------------------------------------------
print_header "6. Systemd Lingering & User Services"

LINGER_FILE="/var/lib/systemd/linger/${TARGET_USER}"
if [[ -f "${LINGER_FILE}" ]]; then
    print_ok "Systemd user lingering is ENABLED (/var/lib/systemd/linger/${TARGET_USER})"
else
    print_warn "Systemd user lingering is DISABLED"
fi

print_info "Listing active user systemd services for '${TARGET_USER}':"
systemctl --user -M "${TARGET_USER}@" list-units --type=service --no-pager 2>&1 | head -n 25 || true

USER_SYSTEMD_DIR="${TARGET_HOME}/.config/systemd/user"
if [[ -d "${USER_SYSTEMD_DIR}" ]]; then
    print_info "Custom user unit files in ${USER_SYSTEMD_DIR}:"
    ls -la "${USER_SYSTEMD_DIR}"
else
    print_info "No custom user unit directory found at ${USER_SYSTEMD_DIR}"
fi

# Crontab check
print_info "Checking crontab for '${TARGET_USER}':"
TARGET_CRON=$(crontab -u "${TARGET_USER}" -l 2>/dev/null || true)
if [[ -n "${TARGET_CRON}" ]]; then
    echo "${TARGET_CRON}"
else
    print_info "No crontab installed for '${TARGET_USER}'"
fi

# ------------------------------------------------------------------------------
# 7. Project Network Ports & Firewall (UFW)
# ------------------------------------------------------------------------------
print_header "7. Project Network Ports & Firewall (UFW)"

PROJECT_PORTS=(3000 4000 5432 6379 9091)
print_info "Checking status of project critical ports:"

for port in "${PROJECT_PORTS[@]}"; do
    LISTEN_PROC=$(ss -tulpn 2>/dev/null | grep ":${port} " || true)
    if [[ -n "${LISTEN_PROC}" ]]; then
        print_warn "Port ${port} is IN USE:"
        echo "    ${LISTEN_PROC}"
    else
        print_ok "Port ${port} is FREE"
    fi
done

# Sysctl unprivileged port start
UNPRIV_PORT=$(sysctl -n net.ipv4.ip_unprivileged_port_start 2>/dev/null || echo "UNKNOWN")
print_info "Sysctl net.ipv4.ip_unprivileged_port_start: ${UNPRIV_PORT}"

# UFW Status
if command -v ufw >/dev/null 2>&1; then
    print_info "UFW Status:"
    ufw status verbose | head -n 25
else
    print_info "UFW utility not installed"
fi

echo -e "\n======================================================================"
echo "  AUDIT COMPLETE"
echo "======================================================================"
