# ![Warlock Logo](public/assets/media/logos/warlock/warlock-lopoly-logo-128x96.webp) ![Warlock Game Server Manager](public/assets/media/logos/warlock/warlock-lopoly-text-246x96.webp)

Warlock is a "bring-your-own-server" game manager that supports managing your fleet of Linux servers.

* [Jump to Quick Install](#production-install)
* [Games Supported](#games-supported)
* New Game Template *(To-Do / Placeholder)*

## Features

- **Modern Single-Page Dashboard**: Fast, responsive React 19 + TypeScript + Tailwind CSS v4 UI with mobile bottom navigation and desktop sidebar.
- **GPU-Accelerated Web Terminal**: Integrated Xterm.js terminal with live Server-Sent Events (SSE) log streaming and command console.
- **In-Browser Code & Config Editor**: CodeMirror 6 with syntax highlighting, search/replace, line wrapping, and keyboard shortcuts (`Ctrl+S`).
- **Remote File Manager**: Chunked file uploads, archive extraction (zip, tar, tgz, etc.), download, rename, and directory breadcrumb navigation.
- **Bearer Token & REST/SSE API**: Automated fleet management via persistent API tokens (`/api/users/tokens`) and standard W3C SSE event streams.
- **Two-Factor Authentication**: Built-in TOTP 2FA with instant QR code scanning and initial fleet setup wizard.
- **Firewall & Port Orchestration**: Automatic UFW/firewalld port provisioning with anti-lockout rules.
- **Backups & Scheduled Tasks**: Automated or manual snapshot creation and one-click restoration.

![Warlock Dashboard](docs/media/warlock-dashboard.webp)


### Host and Service Metrics

Warlock provides historical metrics for each server host and service.

Hosts track CPU, memory, total disk space, and network traffic.

Services track CPU, memory consumption, player count, API response time, and service status.

![Warlock Host Metrics](docs/media/warlock-host-metrics.webp)


### Game Configuration Management

Warlock provides a simple interface for managing game configurations.
Changes are applied immediately and automtically update the necessary
raw configuration file on the server.

![Warlock Game Configuration](docs/media/warlock-service-config.webp)


### Game Logs and Terminal

Logs over the past days and weeks are available for games,
and select games support running commands on the game server.

This includes command autocomplete based off the specific game.

![Warlock Game Logs](docs/media/warlock-service-terminal.webp)


### Game and Host Files

Warlock provides a simple interface for managing game and host files.

* Uploading files
* Deleting files
* Editing text files
* Downloading files
* Extracting archives (zip, rar, tar, tgz, etc)

![Warlock Game Files](docs/media/warlock-service-files.webp)


### Game Backups and Restoration

Backups for each game instance can be manually created or restored,
and backup jobs can be scheduled to run automatically.

_(Important note, backups are stored on the server host,
so for long term storage it is recommended to download important backups._)

![Warlock Game Backups](docs/media/warlock-service-backups.webp)


### Game Versions, Updates, and Restarts

Select games allow installing a specific version of the game.
Additionally, some games also support installing mod loaders directly from within Warlock.

Automatic updates and automatic restarts can also be scheduled
for each game instance.

![Warlock Game Updates](docs/media/warlock-service-settings.webp)

## Getting Started

### Development Build

To get a development build of Warlock up and running:

```bash
git clone https://github.com/hathaway3/Warlock.git
cd Warlock
npm install
npm run build
```

Then you can start the development server:

```bash
npm run dev
```

For live frontend development with Vite Hot-Module-Replacement (HMR):
```bash
npm --prefix frontend run dev
```

During rapid development, the following will be useful.
This will skip database migration checks to allow faster restarting
of the development server:

```bash
npm run dev:quick
```

To profile commands and record a list of how long each takes
and which commands are cached:

```bash
npm run dev:profile
```

To run the automated test suite (backend unit tests + frontend Vitest):
```bash
npm test
```

### Production Install

The recommended method for installing on production servers is using the provided bootstrap script.
The installer automatically handles OS detection, package manager lock resolution, Node.js v24 setup, Nginx reverse proxy configuration, systemd service installation, and firewall anti-lockout rules.

Before installing on a production server, it is recommended to have a domain name (or subdomain) pointed to the server's IP address via an `A` or `CNAME` record. This will enable an SSL certificate to be auto-generated with certbot for Warlock.

#### Debian (11 Bullseye, 12 Bookworm, 13 Trixie)

Debian does not ship with `sudo` by default, so use `su` instead:

```bash
# Using wget:
wget -qO- https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | su - -c "bash" root

# Or using curl:
curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | su - -c "bash" root
```

#### Ubuntu (20.04 Focal, 22.04 Jammy, 24.04 Noble LTS)

Ubuntu ships with `sudo` by default:

```bash
# Using curl:
curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | sudo bash

# Or using wget:
wget -qO- https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | sudo bash
```

#### Non-Interactive & Automation Flags

The bootstrap and installer scripts support headless/automated environments (e.g. Cloud-Init, Ansible, Docker):

```bash
# Accept terms and run completely non-interactively:
curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | sudo bash -s -- --yes

# Specify a custom domain non-interactively:
curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | sudo bash -s -- --yes --fqdn panel.example.com

# Skip Nginx or systemd if running behind an external reverse proxy:
curl -sSL https://raw.githubusercontent.com/hathaway3/Warlock/main/bootstrap.sh | sudo bash -s -- --yes --skip-nginx
```

### Production Build (Manual Process)

To install Warlock on a server manually as root:

```bash
# Debian/Ubuntu
apt update && apt install -y git
# Fedora/RHEL
dnf install -y git
# Arch Linux
pacman -S --noconfirm git

mkdir -p /var/www
chmod a+rx /var/www
cd /var/www
git clone https://github.com/hathaway3/Warlock.git
cd Warlock
./install-warlock.sh
```

This will install Node and all required dependencies, configure Nginx, and set up Warlock to run as a systemd service.

### Docker Build

Warlock can be run as a Docker container, but an nginx reverse proxy is recommended to handle SSL termination.

```bash
docker pull hathaway3/warlock:latest
docker run \
  --name warlock \
  -p 3077:3077 \
  -v warlock_data:/app/data \
  -v warlock_ssh:/home/warlock/.ssh \
  hathaway3/warlock:latest
```

## Supported Platforms

Warlock is engineered to run seamlessly across modern Linux distributions:
- **Debian**: Debian 11 (Bullseye), Debian 12 (Bookworm), Debian 13 (Trixie)
- **Ubuntu**: Ubuntu 20.04 LTS (Focal), Ubuntu 22.04 LTS (Jammy), Ubuntu 24.04 LTS (Noble)
- **RHEL / Rocky / AlmaLinux / Fedora**: Enterprise Linux 8/9 & modern Fedora
- **Arch Linux**: Modern rolling releases

*Note: Warlock requires Node.js v24 or higher, which is automatically installed by the installer (with direct binary fallbacks if repository packages are unavailable).*

## First Run

When you first install Warlock, you need to set up an admin user via the web interface.
Access your site by its IP or hostname you setup, (recommended to use a domain with SSL/TLS),
and you will be presented with an interface to create your first admin user.

Once created, you can create additional users and add server hosts to your cluster.

By default `localhost` is added as a server host, so you can start installing games right away
on the server on which you install Warlock.
You are free to remove that host from the management interface if you wish to only install games on remote servers.

(_Docker installs will NOT configure localhost as a server host._)

## Server Hosts

Warlock is designed to manage multiple server hosts from a single interface,
allowing you to install games on whichever system you choose.

![Warlock Host Infrastructure](docs/media/warlock-host-infrastructure.png)

![Warlock Server Hosts](docs/media/warlock-hosts.webp)

To add a new server host, you will need to enter its IP address
and ensure it can be reached via SSH from the Warlock server.

Connection from the web management server and game hosts is performed via SSH,
and you will be presented with a command to run on your game host to authorize
the Warlock server to connect.


## Server Files

Warlock provides a basic file management interface for uploading, downloading, and editing configuration files.
This can be useful for various administration tasks.

![Warlock File Manager](docs/media/warlock-host-files.webp)

## Installing Games

Supported games can be installed by selecting the desired game server
and selecting a compatible server host.

![Warlock Install Game](docs/media/warlock-installer.webp)

## Managing Games

Once installed, games and their instances will show on the dashboard,
along with links to start, stop, and configure them.

![Warlock Manage Games](docs/media/warlock-dashboard.webp)

Some games, (like ARK Survival Ascended) install multiple map instances,
with each instance being configurable and manageable separately.


## Games Supported

[![ARK Survival Ascended](https://github.com/cdp1337/ARKSurvivalAscended-Linux/blob/main/images/ark-128x128.webp?raw=true)](https://github.com/cdp1337/ARKSurvivalAscended-Linux)
[![Arma3](https://github.com/BitsNBytes25/Arma3-Installer/blob/main/media/arma3-icon.webp?raw=true)](https://github.com/BitsNBytes25/Arma3-Installer)
[![Hytale](https://github.com/BitsNBytes25/Hytale-Installer/blob/main/media/hytale-128x128.webp?raw=true)](https://github.com/BitsNBytes25/Hytale-Installer)
[![Minecraft](https://github.com/BitsNBytes25/Minecraft-Installer/blob/main/media/minecraft-128x128.webp?raw=true)](https://github.com/BitsNBytes25/Minecraft-Installer)
[![Palworld](https://github.com/BitsNBytes25/Palworld-Installer/blob/main/media/palworld-128x128.webp?raw=true)](https://github.com/BitsNBytes25/Palworld-Installer)
[![Project Zomboid](https://github.com/BitsNBytes25/Zomboid-Installer/blob/main/media/zomboid-128x128.webp?raw=true)](https://github.com/BitsNBytes25/Zomboid-Installer)
[![Valheim](https://github.com/BitsNBytes25/Valheim-Installer/blob/main/media/valheim-128x128.webp?raw=true)](https://github.com/BitsNBytes25/Valheim-Installer)
[![VEIN](https://github.com/BitsNBytes25/VEIN-Dedicated-Server/blob/main/media/vein-128x128.png?raw=true)](https://github.com/BitsNBytes25/VEIN-Dedicated-Server)
[![Windrose](https://github.com/BitsNBytes25/Windrose-Installer/blob/main/media/windrose-icon.webp?raw=true)](https://github.com/BitsNBytes25/Windrose-Installer)

_All game names, logos, and artwork shown above are the property of their respective owners and are used here solely to identify the software Warlock can manage. See [Trademarks and Legal Disclaimers](#trademarks-and-legal-disclaimers)._

To add a new game, check out the Game Template documentation *(To-Do: fork template repository)*
for example code and instructions on getting started!

Most games utilize the [Warlock Manager](https://github.com/BitsNBytes25/Warlock-Manager)
library for providing a standardized API and TUI for interacting with game services.

While technically not required, it is highly recommended that new games use this library
to ensure compatibility with the web manager.

## Updating Warlock

To update Warlock, connect to your server via SSH and run:

```bash
sudo /var/www/Warlock/update-warlock.sh
```

Additionally, the bootstrap can be ran again which will detect an existing installation
and call update automatically.

This should prompt with available branches, continuing through will default will use the current branch.

```
Fetching remote branch information...
remote: Enumerating objects: 3, done.
remote: Counting objects: 100% (3/3), done.
remote: Total 3 (delta 2), reused 3 (delta 2), pack-reused 0 (from 0)
Unpacking objects: 100% (3/3), 544 bytes | 544.00 KiB/s, done.
From https://github.com/hathaway3/Warlock
   8b9c069..b9e5c0c  main       -> origin/main

Available remote branches:

  [1] * main (2026-03-16) b9e5c0c [CURRENT]
  [2] release-v1.2 (2026-03-15) 75a41dc
  [3] release-v1.0 (2026-01-16) 93b34a1

  [0] Cancel

Select branch number to switch/upgrade (default: main): 
Using current branch: main
Checking for updates on current branch...
From https://github.com/hathaway3/Warlock
 * branch            main       -> FETCH_HEAD
Stopping Warlock service...
Pulling latest changes...
From https://github.com/hathaway3/Warlock
 * branch            main       -> FETCH_HEAD
Updating 8b9c069..b9e5c0c
Fast-forward
 install-warlock.sh | 3 +++
 1 file changed, 3 insertions(+)
Successfully updated to branch: main
Running installer to apply any necessary updates...
```

The updater will handle switching branches (if requested) and running the installer in update mode
to complete the upgrade process.

## Support & Issue Reporting

* [Project Repository](https://github.com/hathaway3/Warlock)
* [Issue Tracker & Bug Reports](https://github.com/hathaway3/Warlock/issues)
* Community Discord: *(To-Do / Placeholder)*
* Social / Fediverse: *(To-Do / Placeholder)*
* Donations & Sponsorship: *(To-Do / Placeholder)*

> [!IMPORTANT]
> This repository is an independently maintained fork with extensive modifications. Please submit all questions, feedback, and bug reports directly to this fork's [Issue Tracker](https://github.com/hathaway3/Warlock/issues). Do **not** contact or report bugs to the upstream parent project or original authors.

## Analytics & Telemetry

Remote analytics and telemetry reporting to upstream servers (e.g. `metrics.eval.bz`) have been disabled in this fork. No tracking data or telemetry is transmitted to upstream services.

## AI / LLM Disclaimer

This fork of Warlock exclusively uses AI development tools like **Antigravity CLI** and **Claude Code** for its engineering, architectural enhancements, refactoring, test suite development, and ongoing maintenance.

## Trademarks and Legal Disclaimers

Warlock is an independent, community-developed project. It is **not affiliated with, endorsed by, sponsored by, or otherwise officially connected to** the game developers, publishers, or any other third party listed below. All references to third-party games, services, and trademarks are for identification purposes only and do not imply any affiliation, endorsement, or sponsorship.

The following are trademarks of their respective owners:

* **ARK: Survival Ascended** — a trademark of Studio Wildcard.
* **Arma 3** — a trademark of Bohemia Interactive a.s.
* **Hytale** — a trademark of Hypixel Studios (Hypixel Studios Canada Inc.).
* **Minecraft** — a trademark of Mojang AB and Microsoft Corporation.
* **Palworld** — PALWORLD® is a registered trademark of Pocketpair, Inc.
* **Project Zomboid** — a trademark of The Indie Stone.
* **Valheim** — a trademark of Iron Gate Studio and/or Coffee Stain.
* **VEIN** — a trademark of Ramjet Studios.
* **Windrose** — a trademark of Kraken Express.

Game logos, icons, artwork, and screenshots displayed in Warlock (in this README, the web interface, and the documentation) are the property of their respective owners and are used solely to identify the software that Warlock can manage. Warlock does not redistribute game binaries or content; installing a game requires, and is subject to, the applicable game's license and terms of service, which you must obtain and comply with separately.

Other third-party names and products referenced in Warlock or its documentation — including **Steam** (Valve Corporation), **Proxmox VE** (Proxmox Server Solutions GmbH), **Nitrado**, operating system names and logos (Ubuntu/Canonical, Debian, Red Hat/RHEL, SUSE, Fedora, Arch Linux, Rocky, FreeBSD, Linux Mint, macOS/Apple), **Node.js** (OpenJS Foundation), **Docker** (Docker, Inc.), **Nginx**, **systemd**, **certbot** (Electronic Frontier Foundation), **React** (Meta Platforms), **TypeScript** (Microsoft Corporation), **Xterm.js**, **CodeMirror**, and **W3C** — are trademarks or registered trademarks of their respective owners.

All other product names, logos, and brands referenced in this repository are the property of their respective owners. Use of these names, logos, and brands does not imply endorsement by their owners.
