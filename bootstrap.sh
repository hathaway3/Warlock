#!/usr/bin/env bash
#
# Bootstrap script to set up the Warlock environment.
# This script will install git (if necessary), clone the Warlock repository in /var/www/Warlock,
# and run update-warlock.sh in that directory to complete the setup.
#
# This is meant as a one-liner that users can run with curl or wget to quickly set up Warlock.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | bash
#   or:
#   wget -qO- https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | su - -c "bash" root
#
# Options:
#   --repo <url>      Override git repository URL (default: https://github.com/hathaway3/Warlock.git)
#   --branch <name>   Override branch to clone (default: main)
#   All other options are forwarded directly to update-warlock.sh and install-warlock.sh:
#   --yes, -y         Non-interactive mode
#   --fqdn <domain>   Set server domain name non-interactively
#   --skip-nginx      Skip Nginx installation
#   --skip-systemd    Skip systemd installation
#
# @author Charlie Powell <cdp1337@bitsnbytes.dev>
# @license AGPLv3.0
# @see https://warlock.nexus
# @source https://github.com/hathaway3/Warlock
#

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color


# Ensure debconf and needrestart do not prompt interactively on Debian 11/12/13
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

wait_for_apt_lock() {
	if ! command -v fuser >/dev/null 2>&1; then
		return 0
	fi
	local count=0
	local max=30
	while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/lib/dpkg/lock >/dev/null 2>&1; do
		if [ $count -eq 0 ]; then
			echo -e "${YELLOW}Waiting for background package management processes (e.g. unattended-upgrades) to release locks...${NC}"
		fi
		sleep 2
		count=$((count + 1))
		if [ $count -ge $max ]; then
			echo -e "${YELLOW}Warning: Package manager lock wait timed out; attempting to proceed...${NC}"
			break
		fi
	done
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
	echo -e "${RED}Error: This script must be run as root${NC}" >&2
	exit 1
fi

echo -e "${GREEN}Starting Warlock bootstrap setup...${NC}"

# Detect OS and install git if necessary
if ! command -v git &> /dev/null; then
	echo -e "${YELLOW}Git not found. Installing git...${NC}"
	if command -v apt-get &> /dev/null; then
		wait_for_apt_lock
		apt-get update -qq
		apt-get install -y --no-install-recommends git ca-certificates curl
	elif command -v dnf &> /dev/null; then
		dnf install -y git ca-certificates curl
	elif command -v yum &> /dev/null; then
		yum install -y git ca-certificates curl
	elif command -v pacman &> /dev/null; then
		pacman -S --noconfirm git ca-certificates curl
	elif command -v apk &> /dev/null; then
		apk add git ca-certificates curl
	else
		echo -e "${RED}Error: Could not detect package manager to install git${NC}" >&2
		exit 1
	fi
	echo -e "${GREEN}Git installed successfully${NC}"
else
	echo -e "${GREEN}Git is already installed${NC}"
fi

# Repository and branch configuration (can be overridden via environment or CLI args)
REPO_URL="${WARLOCK_REPO:-https://github.com/hathaway3/Warlock.git}"
BRANCH="${WARLOCK_BRANCH:-main}"

# Parse optional bootstrap-specific arguments while preserving arguments for update/install
PASSTHROUGH_ARGS=()
while [[ $# -gt 0 ]]; do
	case "$1" in
		--repo)
			shift
			if [[ $# -gt 0 ]]; then
				REPO_URL="$1"
				shift
			fi
			;;
		--branch)
			shift
			if [[ $# -gt 0 ]]; then
				BRANCH="$1"
				shift
			fi
			;;
		*)
			PASSTHROUGH_ARGS+=("$1")
			shift
			;;
	esac
done

# Create installation directory
if [ -e "/var/www/Warlock" ]; then
	# Previous instructions used uppercase 'Warlock' for the directory, so check for that first and use it if it exists
	# I realized this was silly when I had to use SHIFT when navigating to the directory...
	# If it's there though, go ahead and support it.
	INSTALL_DIR="/var/www/Warlock"
else
	INSTALL_DIR="/var/www/warlock"
fi

if [ ! -d "$INSTALL_DIR" ]; then
	echo -e "${YELLOW}Creating installation directory: $INSTALL_DIR${NC}"
    mkdir -p /var/www
fi

chmod a+rx /var/www

# Check if directory already exists
if [[ -d "$INSTALL_DIR/.git" ]]; then
	echo -e "${YELLOW}Warlock repository already exists at $INSTALL_DIR.${NC}"
else
	echo -e "${YELLOW}Cloning Warlock repository from $REPO_URL ($BRANCH) to $INSTALL_DIR...${NC}"
	git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi

echo -e "${GREEN}Repository ready at $INSTALL_DIR${NC}"

cd "$INSTALL_DIR"
chmod +x update-warlock.sh
./update-warlock.sh "${PASSTHROUGH_ARGS[@]}"

echo -e "${GREEN}Warlock bootstrap setup completed successfully!${NC}"
