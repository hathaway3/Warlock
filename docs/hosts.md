---
title: Hosts
seotitle: Warlock Hosts
description: Server host overview for Warlock Game Server Manager
order: 14
sidebar:
  - widget: cms-pagelist
    type: pages
    layout: widgets/pages-nav-sidebar
    permalink: "~ /projects/warlock/.*"
    sort: order
  - widget: cta
    href: https://github.com/BitsNBytes25/Warlock
    text: View on GitHub
image:
  src: media/warlock-hosts.webp
---

# Warlock Server Hosts

Warlock by default provides access to install game servers on the host which it is installed on,
but it can also handle multiple hosts in a game cluster.

This allows you to have multiple servers for different games, or even the same game on different hosts.

![Warlock Hosts](media/warlock-hosts.webp)

## Adding Hosts

Adding a new host to Warlock is done via the **Add Host** button on the Hosts page. Warlock provides three methods to add and configure server hosts:

### 1. One-Line Bootstrap (Recommended)

The fastest and cleanest way to enroll an existing server into Warlock:
1. Click **Add Host** and select the **One-Line Bootstrap** tab.
2. Copy the generated bootstrap command:
   ```bash
   curl -sSL "http://<warlock-host>:3077/api/hosts/enroll.sh?token=<token>" | sudo bash
   ```
3. Paste and run it on your remote machine terminal.
4. The script automatically authorizes Warlock's SSH key, detects the primary IP address, and calls back to Warlock to register the server. The host will appear in your fleet instantly without any manual key copying!

### 2. Proxmox VE Provisioning

Easily deploy and connect new Debian 12 LXC containers running on your Proxmox Virtual Environment:
- **Community Scripts Helper**: Run the [Community-Scripts.org Debian 12 LXC](https://community-scripts.org/scripts/debian) command in your Proxmox node shell, then enroll it with the One-Line Bootstrap command.
- **Proxmox REST API Integration**: Enter your Proxmox cluster URL and API token to discover nodes, select storage pools, and provision a container with Warlock's SSH keys pre-injected in 1-click.

See [PROXMOX_INTEGRATION.md](PROXMOX_INTEGRATION.md) for full setup instructions and API token permissions.

### 3. Manual IP / SSH Key

If connecting to an air-gapped or pre-configured host:
1. Enter the IP address or hostname in the **Manual IP / SSH** tab.
2. If root key-based SSH is not yet authorized, Warlock provides a fallback command to append the key to `/root/.ssh/authorized_keys`.
3. Once authorized, click **Retry Connection**.

Supported hosts are:

* Debian (recommended)
* Ubuntu (recommended)
* Fedora
* RHEL/Rocky
* SuSE
* Arch

## Host Firewall

To help secure your game servers, most Warlock games will automatically install `UFW`
for a host firewall. 
This firewall can be managed via the "Firewall" option on each host.

![Host Firewall](media/warlock-host-firewall.webp)

Custom rules can be added to your host firewall as needed,
and game ports will be listed to offer a one-click option to open game ports.

(Please note, some ports like Palworld's REST port should not be globally available.)

Most games will automatically add the necessary rules when installed.