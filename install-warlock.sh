#!/usr/bin/env bash
#
# Install Warlock as a systemd service in-place (service runs from the directory where this script lives)
#
# Usage:
#   install-warlock.sh [--user <name>] [--help] [--skip-nginx] [--skip-systemd] [--update]
#
# Running with --update will skip nginx and systemd configuration and just update dependencies and the .env file if needed.
#
# @author Charlie Powell <cdp1337@bitsnbytes.dev>
# @license AGPLv3.0
# @see https://warlock.nexus
# @source https://github.com/hathaway3/Warlock
#


#############
## Variable declaration and setup
#############

SCRIPT_NAME=$(basename "$0")
INSTALL_DIR="$(dirname "$(readlink -f "$0")")"
export PATH="/usr/local/bin:$PATH"

# Re-attach stdin to terminal if running through a pipe, or set non-interactive
if [ ! -t 0 ]; then
	if [ -c /dev/tty ]; then
		exec < /dev/tty
	else
		NON_INTERACTIVE=1
	fi
fi

NODE_BIN=""
SERVICE_UNIT_PATH="/etc/systemd/system/warlock.service"
ENV_FILE="$INSTALL_DIR/.env"
SERVICE_USER=root
CONFIGURE_NGINX=1
CONFIGURE_SYSTEMD=1
ONLY_UPDATE=0
CONFIGURE_FIREWALL=0
FQDN=""
SSL=0
WARLOCK_LISTEN_IP="127.0.0.1"
WARLOCK_LISTEN_PORT="3077"
NON_INTERACTIVE=0

wait_for_apt_lock() {
	if ! command -v fuser >/dev/null 2>&1; then
		return 0
	fi
	local count=0
	local max=30
	while fuser /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/lib/dpkg/lock >/dev/null 2>&1; do
		if [ $count -eq 0 ]; then
			echo "Waiting for background package management processes to release locks..."
		fi
		sleep 2
		count=$((count + 1))
		if [ $count -ge $max ]; then
			echo "Warning: Package manager lock wait timed out; attempting to proceed..."
			break
		fi
	done
}

print_help() {
	cat <<EOF
Usage: $SCRIPT_NAME [options]

Options:
  --user <name>                 Run the service as <name> (default: root)
  --skip-nginx                  Do not configure nginx even if it is installed
  --skip-systemd                Do not configure systemd service (just install dependencies and generate .env)
  --update                      Update an existing installation ONLY
  --yes, -y, --non-interactive  Run without interactive prompts, accepting terms and using defaults
  --fqdn <domain>               Set fully qualified domain name non-interactively
  --help                        Show this help message

This installer will:
 - Resolve the install directory to the location of this script and run the service from there
 - Detect the node binary and generate a systemd unit at $SERVICE_UNIT_PATH
 - Enable and start the warlock.service via systemd

Note: This script must be run as root to install the systemd unit and write to /etc.
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
	case "$1" in
		--user)
			shift
			if [[ $# -eq 0 ]]; then
				echo "--user requires an argument" >&2
				exit 1
			fi
			SERVICE_USER="$1"
			shift
			;;
		--skip-systemd)
			CONFIGURE_SYSTEMD=0
			shift
			;;
		--skip-nginx)
			CONFIGURE_NGINX=0
			shift
			;;
		--update)
			ONLY_UPDATE=1
			CONFIGURE_NGINX=0
			CONFIGURE_SYSTEMD=0
			shift
			;;
		--yes|-y|--non-interactive)
			NON_INTERACTIVE=1
			shift
			;;
		--fqdn)
			shift
			if [[ $# -eq 0 ]]; then
				echo "--fqdn requires an argument" >&2
				exit 1
			fi
			FQDN="$1"
			shift
			;;
		--help)
			print_help
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			print_help
			exit 1
			;;
	esac
done

# Robust Linux / Debian detection via /etc/os-release (POSIX standard across Debian 11/12/13, Ubuntu, RHEL, etc.)
if [ -f /etc/os-release ]; then
	. /etc/os-release
	DISTRO="${ID:-}"
	DISTRO_VERSION="${VERSION_ID:-}"
	DISTRO_CODENAME="${VERSION_CODENAME:-}"
	DISTRO_LIKE="${ID_LIKE:-}"
elif command -v lsb_release >/dev/null 2>&1; then
	DISTRO="$(lsb_release -i 2>/dev/null | sed "s#.*:\t##" | tr '[:upper:]' '[:lower:]')"
elif [ -f /etc/debian_version ]; then
	DISTRO="debian"
	DISTRO_VERSION="$(cat /etc/debian_version 2>/dev/null)"
else
	DISTRO="unknown"
fi

# Normalize distribution family (Debian 11, 12, 13 and all derivatives like Ubuntu, Raspbian, Pop, Mint)
if [ "$DISTRO" == "ubuntu" ] || [ "$DISTRO" == "debian" ] || [ "$DISTRO" == "raspbian" ] || [ "$DISTRO" == "pop" ] || [ "$DISTRO" == "linuxmint" ] || [ "$DISTRO" == "kali" ] || [[ "$DISTRO_LIKE" == *"debian"* ]]; then
	DISTRO_FAMILY="debian"
elif [ "$DISTRO" == "centos" ] || [ "$DISTRO" == "rocky" ] || [ "$DISTRO" == "almalinux" ] || [ "$DISTRO" == "rhel" ] || [[ "$DISTRO_LIKE" == *"rhel"* ]]; then
	DISTRO_FAMILY="rhel"
elif [ "$DISTRO" == "fedora" ] || [[ "$DISTRO_LIKE" == *"fedora"* ]]; then
	DISTRO_FAMILY="fedora"
else
	DISTRO_FAMILY="$DISTRO"
fi

install_node_binary() {
	local ARCH
	ARCH="$(uname -m)"
	case "$ARCH" in
		x86_64) NODE_ARCH="x64" ;;
		aarch64|arm64) NODE_ARCH="arm64" ;;
		armv7l) NODE_ARCH="armv7l" ;;
		*) echo "Unsupported architecture for Node binary installation: $ARCH" >&2; return 1 ;;
	esac

	# Ensure tar and xz decompression tools are available
	if ! command -v xz >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
		if [ "$DISTRO_FAMILY" == "debian" ]; then
			wait_for_apt_lock
			apt-get update -qq
			apt-get install -y --no-install-recommends xz-utils tar
		elif [ "$DISTRO_FAMILY" == "rhel" ] || [ "$DISTRO_FAMILY" == "fedora" ]; then
			yum install -y xz tar
		fi
	fi

	echo "Attempting Node.js v24 standalone binary installation for linux-$NODE_ARCH..."
	local TMP_TAR="/tmp/node-v24-linux-$NODE_ARCH.tar.xz"
	local NODE_URL="https://nodejs.org/dist/latest-v24.x/"
	local LATEST_FILE
	LATEST_FILE="$(curl -fsSL https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt 2>/dev/null | grep "linux-${NODE_ARCH}.tar.xz" | head -n1 | awk '{print $2}')"
	if [ -n "$LATEST_FILE" ]; then
		NODE_URL="https://nodejs.org/dist/latest-v24.x/$LATEST_FILE"
	else
		NODE_URL="https://nodejs.org/dist/v24.2.0/node-v24.2.0-linux-${NODE_ARCH}.tar.xz"
	fi

	if curl -fsSL "$NODE_URL" -o "$TMP_TAR"; then
		tar -xJf "$TMP_TAR" -C /usr/local --strip-components=1 --no-same-owner
		rm -f "$TMP_TAR"
		export PATH="/usr/local/bin:$PATH"
		if command -v node >/dev/null 2>&1; then
			echo "Node.js $(node --version) installed successfully to /usr/local"
			return 0
		fi
	fi
	return 1
}

install_node() {
	if [ "$EUID" -ne 0 ]; then
		echo "Warlock requires Node.js v24 or higher to run. Please install Node.js and re-run this installer." >&2
		exit 1
	fi

	case "$DISTRO_FAMILY" in
		"debian")
			export DEBIAN_FRONTEND=noninteractive
			export NEEDRESTART_MODE=a
			wait_for_apt_lock
			apt-get update -qq
			apt-get install -y --no-install-recommends ca-certificates curl gnupg xz-utils tar

			# On Debian 13 (Trixie) or future releases, NodeSource may not have a trixie-specific tag yet.
			# Using bookworm as NODESOURCE_DISTRO guarantees ABI compatibility on Debian 13+.
			if [ "$DISTRO" == "debian" ] && [ "${DISTRO_CODENAME:-}" == "trixie" ]; then
				export NODESOURCE_DISTRO=bookworm
			fi

			if curl -fsSL https://deb.nodesource.com/setup_24.x | bash -; then
				wait_for_apt_lock
				apt-get install -y nodejs
			fi

			# Verify Node is >= 24, otherwise use standalone binary fallback
			local CURR_VER
			CURR_VER="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
			if [[ "${CURR_VER:-0}" -lt 24 ]]; then
				echo "Apt did not provide Node.js v24. Using standalone binary fallback..."
				install_node_binary
			fi
			;;
		"rhel")
			curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
			yum install -y nodejs xz tar
			local CURR_VER
			CURR_VER="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
			if [[ "${CURR_VER:-0}" -lt 24 ]]; then
				install_node_binary
			fi
			;;
		"fedora")
			curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
			dnf install -y nodejs xz tar
			local CURR_VER
			CURR_VER="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
			if [[ "${CURR_VER:-0}" -lt 24 ]]; then
				install_node_binary
			fi
			;;
		*)
			install_node_binary || {
				echo "Automatic Node.js installation not supported on this distribution ($DISTRO). Please install Node.js v24 or higher manually." >&2
				exit 1
			}
			;;
	esac
}

find_nginx() {
	# Debian ships nginx in /usr/sbin/nginx, which is not in the path for non-root users.
	# Check the path manually if necessary.
	if command -v nginx >/dev/null 2>&1; then
		command -v nginx
	elif [ -x "/usr/sbin/nginx" ]; then
		echo "/usr/sbin/nginx"
	else
		echo ""
	fi
}

install_nginx() {
	if [ "$EUID" -ne 0 ]; then
		echo "Unable to install nginx without root permissions!  Please run with --skip-nginx or manually install nginx." >&2
		exit 1
	fi

	case "$DISTRO_FAMILY" in
		"debian")
			export DEBIAN_FRONTEND=noninteractive
			export NEEDRESTART_MODE=a
			wait_for_apt_lock
			apt-get update -qq
			apt-get install -y nginx
			;;
		"rhel")
			yum install -y nginx
			;;
		"fedora")
			dnf install -y nginx
			;;
		*)
			echo "Automatic Nginx installation not supported on this distribution ($DISTRO). Please install Nginx manually or re-run this script with --skip-nginx." >&2
			exit 1
			;;
	esac
}

install_certbot() {
	if [ "$EUID" -ne 0 ]; then
		echo "Unable to install certbot without root permissions!  Skipping SSL." >&2
		return
	fi

	case "$DISTRO_FAMILY" in
		"debian")
			export DEBIAN_FRONTEND=noninteractive
			export NEEDRESTART_MODE=a
			wait_for_apt_lock
			# On Ubuntu minimal images, certbot packages are in the universe repository
			if [ "$DISTRO" == "ubuntu" ]; then
				if command -v add-apt-repository >/dev/null 2>&1; then
					add-apt-repository -y universe >/dev/null 2>&1 || true
				fi
			fi
			apt-get update -qq
			apt-get install -y certbot python3-certbot-nginx
			;;
		"rhel")
			yum install -y certbot python3-certbot-nginx
			;;
		"fedora")
			dnf install -y certbot python3-certbot-nginx
			;;
		*)
			echo "Automatic certbot installation not supported on this distribution ($DISTRO). Please install certbot manually if you wish to use SSL certificates." >&2
			;;
	esac
}

install_curl() {
	if [ "$EUID" -ne 0 ]; then
		echo "Unable to install curl without root permissions!  Please install curl manually." >&2
		exit 1
	fi

	case "$DISTRO_FAMILY" in
		"debian")
			export DEBIAN_FRONTEND=noninteractive
			export NEEDRESTART_MODE=a
			wait_for_apt_lock
			apt-get update -qq
			apt-get install -y --no-install-recommends curl ca-certificates gnupg xz-utils tar openssh-client
			;;
		"rhel")
			yum install -y curl ca-certificates openssh-clients
			;;
		"fedora")
			dnf install -y curl ca-certificates openssh-clients
			;;
		*)
			echo "Automatic curl installation not supported on this distribution ($DISTRO). Please install curl manually." >&2
			exit 1
			;;
	esac
}

# Confirm this script is located within /var/www
if [[ "$INSTALL_DIR" != /var/www* ]]; then
	echo "Warlock not located in /var/www/..., disabling nginx and systemd integration"
	CONFIGURE_NGINX=0
	CONFIGURE_SYSTEMD=0
fi

if [ "$EUID" -ne 0 ]; then
	echo "Not running as root, disabling nginx and systemd integration"
	CONFIGURE_NGINX=0
	CONFIGURE_SYSTEMD=0
fi

if [ $CONFIGURE_NGINX -eq 0 ]; then
	# If no nginx is requested, change the default listen IP to 0.0.0.0 to allow Warlock to respond on all interfaces.
	WARLOCK_LISTEN_IP="0.0.0.0"
fi


#############
## Execution plan and user confirmation
#############

echo ""
cat <<EOD
##############################################################
##                 WARLOCK SERVER INSTALLER                 ##
##############################################################

This script will install Warlock Game Server Manager and:
EOD

if [ ! -f "$ENV_FILE" ]; then
	echo "  * Create $ENV_FILE with defaults"
fi
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "  * Create /etc/systemd/system/warlock.service"
fi
if [ $CONFIGURE_NGINX -eq 1 ]; then
	if [ -z "$(find_nginx)" ]; then
		echo "  * Install nginx for HTTP/HTTPS reverse proxy"
	fi
	if ! command -v certbot >/dev/null 2>&1; then
		echo "  * Install certbot for SSL certificate management"
	fi
	echo "  * Create and enable /etc/nginx/sites-available/warlock"
fi
if ! command -v curl >/dev/null 2>&1; then
	echo "  * Install curl"
fi
if ! command -v node >/dev/null 2>&1; then
	echo "  * Install Node.js version 24"
else
	VERSION="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
	if [[ "${VERSION:-0}" -lt 24 ]]; then
		echo "  * Upgrade Node.js from version $VERSION to version 24"
	fi
fi
echo "  * Run npm install to install dependencies for Warlock"
if [ $ONLY_UPDATE -eq 0 ]; then
	echo "  * Optionally install system firewall"
	if [ $CONFIGURE_NGINX -eq 1 ]; then
		echo "  * if firewall - allow HTTP/HTTPS traffic on port 80/443"
	else
		echo "  * if firewall - allow traffic on the port specified in $ENV_FILE (default ${WARLOCK_LISTEN_PORT})"
	fi
	echo "  * if firewall - add anti-lockout rule for current user's IP address"
fi
echo ""


#############
## Terms and conditions (skip if updating)
#############

if [ $ONLY_UPDATE -eq 0 ]; then
	if [ $NON_INTERACTIVE -eq 1 ]; then
		echo "Non-interactive installation: Automatically accepting terms and conditions."
		AGREE="y"
	else
		echo "Press ENTER to continue or CTRL+C to abort."
		read -r

		cat <<EOF



##  TERMS AND CONDITIONS

By installing Warlock you are agreeing to the following terms:

Warlock is provided 'as-is', without any express or implied warranty
  and is published under the AGPLv3 license,
  (which in short means that if you modify and distribute the code, you must also
  distribute your modifications under the same license and provide attribution).

Warlock is offered as free software under the AGPLv3 license.

Telemetry & Analytics:
  Remote analytics and telemetry reporting to upstream servers are disabled
  in this fork. No tracking data or telemetry is transmitted to upstream services.

For more information, please refer to:
 * Project Repository: https://github.com/hathaway3/Warlock
 * Issue Tracker & Bug Reports: https://github.com/hathaway3/Warlock/issues
 * Documentation: https://github.com/hathaway3/Warlock#readme

Do you agree to these terms? (y/N)
EOF
		read -r AGREE
	fi
	case "$AGREE" in
    	[yY][eE][sS]|[yY]) ;;
    	*) echo "Aborted by user."; exit 1 ;;
    esac
fi


#############
## Question prompting
#############

if [ -e "/etc/nginx/sites-available/warlock" ]; then
	if [ -z "$FQDN" ]; then
		FQDN=$(grep -m1 'server_name' /etc/nginx/sites-available/warlock | awk '{print $2}' | tr -d ';')
	fi
	if grep -q 'listen 443 ssl' /etc/nginx/sites-available/warlock; then
		SSL=1
	fi
fi

if [ $CONFIGURE_NGINX -eq 1 ]; then
	if [ -n "$FQDN" ]; then
		echo "Using existing FQDN from nginx config: $FQDN"
	elif [ $NON_INTERACTIVE -eq 1 ]; then
		echo "Non-interactive installation: Defaulting FQDN to wildcard (_)."
		FQDN="_"
	else
		cat <<EOD



##  DOMAIN NAME FOR WARLOCK

Warlock is accessed via a web browser by either an IP address or a domain name.
If you have a domain name pointed to this server, please enter it here.

This will enable SSL certificate generation via certbot.
If you do not have a domain name, just press ENTER to continue.

What is the fully qualified domain name (FQDN) for this server? (used in nginx config and SSL registration)
EOD
		read -r FQDN
	fi

	if [ -z "$FQDN" ]; then
		# _ is a wildcard for nginx server_name
		FQDN="_"
	fi
fi

if [ $ONLY_UPDATE -eq 0 ]; then
	if [ $NON_INTERACTIVE -eq 1 ]; then
		echo "Non-interactive installation: Installing firewall by default."
		CONFIGURE_FIREWALL=1
	else
		cat <<EOD



##  FIREWALL CONFIGURATION

It is recommended to install a system firewall to control access to various resources.

This is particularly important if you are planning on installing games on the server
that Warlock is running on, as many games will recommend a firewall to control
access to management ports and block bad actors.

Install firewall? (Y/n):
EOD
		read -r Q
		case "$Q" in
			[yY][eE][sS]|[yY]) CONFIGURE_FIREWALL=1;;
			'') CONFIGURE_FIREWALL=1;;
			*) echo "Skipping firewall";;
		esac
	fi
fi


#############
## Install dependencies for this application.
#############

# Ensure curl is available, (Debian doesn't ship with it by default)
if ! command -v curl >/dev/null 2>&1; then
	echo "curl binary not found in PATH. Attempting installation" >&2
	install_curl
fi

# Locate node
if ! command -v node >/dev/null 2>&1; then
	echo "Node.js binary not found in PATH. Attempting installation" >&2
	install_node
fi

# Node should be installed now, but check again.
if ! NODE_BIN=$(command -v node); then
	echo "Node.js binary not found in PATH.  Cannot continue!" >&2
	exit 1
fi

VERSION="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
if [[ "${VERSION:-0}" -lt 24 ]]; then
	echo "Node.js requires upgrading.  Attempting installation" >&2
	install_node
	VERSION="$(node --version 2>/dev/null | sed 's:v::' | cut -d '.' -f 1)"
	if [[ "${VERSION:-0}" -lt 24 ]]; then
		echo "Error: Node.js version is still below 24 (found: $VERSION). Cannot continue." >&2
		exit 1
	fi
fi

echo "Using Node $(node --version) at $NODE_BIN"

if [ $CONFIGURE_NGINX -eq 1 ]; then
	if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet apache2 2>/dev/null; then
		echo "Warning: Apache (apache2) is running and bound to port 80. Nginx may conflict unless Apache is stopped." >&2
	fi

	if [ -z "$(find_nginx)" ]; then
		echo "Warning: Nginx not found.  Attempting auto install" >&2
		install_nginx
	fi

	if ! command -v certbot >/dev/null 2>&1; then
		echo "Warning: certbot not found in PATH.  Attempting auto install" >&2
		install_certbot
	fi
fi

if [ $CONFIGURE_FIREWALL -eq 1 ]; then
	echo "Installing firewall..."
	"$INSTALL_DIR/scripts/linux_install_firewall.sh"
	"$INSTALL_DIR/scripts/linux_util_firewall_allow.sh" --port 22 --comment "SSH access"
	if [ $CONFIGURE_NGINX -eq 1 ]; then
		"$INSTALL_DIR/scripts/linux_util_firewall_allow.sh" --port 80 --comment "Access Warlock (HTTP)"
		"$INSTALL_DIR/scripts/linux_util_firewall_allow.sh" --port 443 --comment "Access Warlock (HTTPS)"
	elif [ "$WARLOCK_LISTEN_IP" == "0.0.0.0" ]; then
		# If listening on all interfaces, allow the port globally
		"$INSTALL_DIR/scripts/linux_util_firewall_allow.sh" --port "$WARLOCK_LISTEN_PORT" --comment "Access Warlock"
	fi
fi

PWD="$(pwd)"
if [ "$PWD" != "$INSTALL_DIR" ]; then
	cd "$INSTALL_DIR"
fi
echo "Running npm install in $INSTALL_DIR to handle all dependencies..."
npm install
if [ -d "$INSTALL_DIR/frontend" ]; then
	if [ ! -f "$INSTALL_DIR/public/dist/index.html" ]; then
		echo "Building modern frontend assets..."
		if [ ! -d "$INSTALL_DIR/frontend/node_modules" ]; then
			npm --prefix "$INSTALL_DIR/frontend" install
		fi
		npm --prefix "$INSTALL_DIR/frontend" run build
	else
		echo "Pre-built modern frontend assets detected in public/dist."
	fi
fi
if [ "$PWD" != "$INSTALL_DIR" ]; then
	cd "$PWD"
fi

# Generate unit file
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "Generating and saving unit file"
	TMP_UNIT=$(mktemp)
	cat > "$TMP_UNIT" <<UNIT
[Unit]
Description=Warlock Management App
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/app.js
Restart=on-failure
# Run as the requested user (omit or set to root by default)
User=$SERVICE_USER
# Environment file (optional)
EnvironmentFile=$ENV_FILE
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

	chmod 0644 "$TMP_UNIT"
	mv "$TMP_UNIT" "$SERVICE_UNIT_PATH"
fi

# Create environment file
if [ ! -e "$ENV_FILE" ]; then
	SECRET="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)"
	cat > "$ENV_FILE" <<ENV
IP=$WARLOCK_LISTEN_IP
PORT=$WARLOCK_LISTEN_PORT
NODE_ENV=production
SESSION_SECRET=$SECRET
SKIP_AUTHENTICATION=false
SKIP_2FA=false
WARLOCK_PROFILE=false
ENV
	if [ "$SERVICE_USER" != "root" ]; then
		chown -R "$SERVICE_USER":"$SERVICE_USER" "$INSTALL_DIR"
	fi
fi

# Reload systemd and enable/start service
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "Reloading systemd daemon..."
	systemctl daemon-reload

	echo "Enabling and starting warlock.service..."
	if ! systemctl enable --now warlock.service; then
		echo "Failed to enable/start warlock.service. Check 'journalctl -u warlock.service' for details." >&2
		exit 1
	fi
fi

# If nginx is installed, generate a simple site config that reverse-proxies to the local app
if [ $CONFIGURE_NGINX -eq 1 ]; then
	echo "Generating nginx site config..."
	NGINX_AVAILABLE="/etc/nginx/sites-available/warlock"
	NGINX_ENABLED="/etc/nginx/sites-enabled/warlock"
	# Backup existing config if present
	if [[ -f "$NGINX_AVAILABLE" ]]; then
		TS=$(date +%s)
		cp -a "$NGINX_AVAILABLE" "${NGINX_AVAILABLE}.bak.$TS"
	fi

	if [ -h /etc/nginx/sites-enabled/default ]; then
		echo "Removing default nginx site symlink"
		unlink /etc/nginx/sites-enabled/default
	fi

	TMP_NGINX=$(mktemp)
	cat > "$TMP_NGINX" <<NGINX
server {
	listen 80;
	server_name $FQDN;

	client_max_body_size 50M;
	proxy_request_buffering off;
	proxy_buffering off;
	proxy_pass_request_body on;
	proxy_read_timeout 10m;

	# Serve the service worker at root so it can control site-wide scope
	location = /service-worker.js {
		alias $INSTALL_DIR/public/service-worker.js;
		access_log off;
	}

	# Serve static assets directly from the install directory
	location /assets/ {
		alias $INSTALL_DIR/public/assets/;
		access_log off;
		expires 1d;
	}

	# Serve compiled modern SPA assets directly with caching
	location /dist/ {
		alias $INSTALL_DIR/public/dist/;
		access_log off;
		expires 7d;
	}

	# Define the error page for 502 errors
	error_page 502 /502.html;
	# Serve the error page from your public directory
	location = /502.html {
		root $INSTALL_DIR/public/;
		internal;
	}

	# Proxy all other requests to the local Node.js app
	location / {
		proxy_pass http://127.0.0.1:$WARLOCK_LISTEN_PORT;
		proxy_http_version 1.1;
		proxy_set_header Upgrade \$http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host \$host;
		proxy_cache_bypass \$http_upgrade;
	}
}
NGINX
	chmod 0644 "$TMP_NGINX"
	mv "$TMP_NGINX" "$NGINX_AVAILABLE"
	ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

	# Test nginx config and reload if valid
	NGINX_PATH="$(find_nginx)"
	if $NGINX_PATH -t >/dev/null 2>&1; then
		echo "Nginx configuration OK — reloading nginx"
		systemctl reload nginx || systemctl restart nginx || echo "Warning: failed to reload nginx" >&2

		if command -v certbot >/dev/null 2>&1 && [ "$FQDN" != "_" ]; then
			echo "Attempting to obtain/renew SSL certificate via certbot for $FQDN"
			if certbot --nginx -d "$FQDN" --non-interactive --agree-tos --redirect; then
				SSL=1
			else
				echo "Warning: certbot failed to obtain/renew certificate" >&2
			fi
		else
			echo "Note: certbot not configured or wildcard host; skipping SSL certificate setup."
		fi
	else
		echo "Warning: generated nginx configuration failed nginx -t. Leaving the file in $NGINX_AVAILABLE for inspection." >&2
	fi
else
	echo "Note: nginx not requested or updating only; skipping nginx site generation."
fi

# Output quick verification
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "Service status:"
	systemctl --no-pager status warlock.service --lines=10 || true
elif [ $ONLY_UPDATE -eq 1 ] && [ "$EUID" -eq 0 ] && [ -e /etc/systemd/system/warlock.service ]; then
	# An update was requested, we have permissions, and the service file exists.
	# Start the service if it's not already running,
	# it was probably stopped prior to the git update from the updater.
	if ! systemctl is-active --quiet warlock; then
		echo "Starting warlock.service..."
		systemctl start warlock

		echo "Service status:"
		systemctl --no-pager status warlock.service --lines=10 || true
	fi
fi

get_ips() {
	local ips=""
	if command -v hostname >/dev/null 2>&1; then
		ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -v '^127\.' | grep -v '^172\.1[7-9]\.' | grep -v ':' | tr '\n' ' ')
	fi
	if [ -z "$ips" ] && command -v ip >/dev/null 2>&1; then
		ips=$(ip -4 addr show 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | grep -v '^127\.' | tr '\n' ' ')
	fi
	if [ -z "$ips" ]; then
		ips="127.0.0.1"
	fi
	echo "$ips"
}

echo "You can access the Warlock web interface at:"
if [ "$FQDN" == "_" ]; then
	# '_' is for wildcard in nginx; it means it's accessible from any IP.
	for IP in $(get_ips); do
		echo "http://$IP/"
	done
elif [ "$FQDN" == "" ]; then
	# An empty FQDN means nginx is not configured, so we should provide the IP and port directly from the .env file
	IP="$(grep -E '^IP=' .env 2>/dev/null | sed 's:.*=::')";
	PORT="$(grep -E '^PORT=' .env 2>/dev/null | sed 's:.*=::')";
	if [ "$IP" == "0.0.0.0" ]; then
		for S_IP in $(get_ips); do
			echo "http://$S_IP:${PORT:-3077}/"
		done
	else
		echo "http://${IP:-127.0.0.1}:${PORT:-3077}/"
	fi
else
	# Any other means nginx is configured with a specific FQDN.
	if [ $SSL -eq 1 ]; then
		echo "https://$FQDN/"
	else
		echo "http://$FQDN/"
	fi
fi

echo "Installation complete. To uninstall, run: sudo ./uninstall-warlock.sh"
