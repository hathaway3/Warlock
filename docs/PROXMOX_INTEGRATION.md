# Proxmox VE Integration & Host Provisioning

Warlock provides native Proxmox Virtual Environment (PVE) integration to deploy and register dedicated game server nodes in seconds. You can provision lightweight, high-performance Debian 12 LXC containers either directly through the Warlock UI via the Proxmox REST API, or via interactive shell helpers powered by [Community-Scripts.org](https://community-scripts.org/scripts/debian).

---

## 1. Integration Methods

| Feature | Proxmox VE API (Automated) | Community Scripts (Helper) | One-Line Bootstrap |
| :--- | :--- | :--- | :--- |
| **Execution Location** | Warlock Web Console | Proxmox Node Shell | Target Server Shell |
| **Speed** | 1-Click (< 30s) | Interactive Terminal | Single Copy-Paste |
| **Container Type** | Debian 12 LXC | Debian 12 LXC (Community Script) | Any Linux Distro / VM / Bare Metal |
| **SSH Key Authorization** | Automatic (`ssh-public-keys` injection) | Injected via `-s SSH_KEY=...` | Configured by bootstrap script |
| **Warlock Auto-Registration** | Automatic via Warlock Fleet Manager | Completed via One-Line Bootstrap | Automatic callback to `/api/hosts/enroll` |

---

## 2. Option A: Proxmox REST API Direct Provisioning

Warlock communicates directly with your Proxmox VE cluster using the Proxmox REST API (`/api2/json`).

### 2.1 Generating a Proxmox API Token

1. Log into your **Proxmox VE Web GUI** (`https://<proxmox-ip>:8006`).
2. Navigate to **Datacenter** > **Permissions** > **API Tokens**.
3. Click **Add**:
   - **User**: `root@pam` (or create a dedicated user e.g. `warlock@pve`).
   - **Token ID**: `warlock`
   - Uncheck **Privilege Separation** (or assign `PVEVMAdmin` and `PVEDatastoreUser` permissions).
4. Save the generated **Secret Key** (this is only shown once).

### 2.2 Provisioning from the Warlock UI

1. In Warlock, navigate to the **Hosts** page and click **Add Host**.
2. Select the **Proxmox VE** tab, then choose **Proxmox VE API (Automated)**.
3. Provide your Proxmox connection details:
   - **Proxmox Host URL**: e.g. `https://192.168.1.50:8006`
   - **API Token User**: `root@pam`
   - **API Token ID**: `warlock`
   - **API Token Secret**: `<your-api-secret-key>`
4. Click **Connect & Discover Nodes**.
5. Select your target cluster node, root storage pool (e.g. `local-lvm`), container hostname, and resource allocations (CPU Cores, RAM, and Disk Size).
6. Click **Provision Debian 12 LXC**.
7. Warlock injects its public SSH key during creation, boots the container, and registers it to your fleet.

---

## 3. Option B: Community-Scripts.org Debian 12 LXC Helper

If you prefer deploying containers directly from the Proxmox host shell, Warlock integrates with the official [Community-Scripts Debian LXC](https://community-scripts.org/scripts/debian).

### 3.1 Proxmox Node Shell Command

Open the web shell on your Proxmox node and run:

```bash
bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/debian.sh)"
```

### 3.2 Unattended Mode with Pre-Configured Specs

Warlock can generate pre-configured unattended commands with your resource requirements and SSH key pre-loaded:

```bash
bash -c "$(wget -qLO - https://github.com/community-scripts/ProxmoxVE/raw/main/ct/debian.sh)" \
  -s CT_TYPE=0 DISK_SIZE=20 CORE_COUNT=2 RAM_SIZE=2048 BRG=vmbr0 \
  SSH_KEY="ecdsa-sha2-nistp521 ... root@warlock"
```

Once created:
1. Boot the new Debian LXC container.
2. Open its console.
3. Paste the **One-Line Bootstrap** command from the Warlock Hosts dialog to enroll it immediately.

---

## 4. Option C: One-Line Host Enrollment

For existing physical servers, cloud VPS instances (AWS, Hetzner, DigitalOcean), or custom VMs, use the automated bootstrap command:

```bash
curl -sSL "http://<warlock-ip>:3077/api/hosts/enroll.sh?token=<token>" | sudo bash
```

### How it Works:
1. **Token Verification**: Warlock issues a cryptographically secure, time-limited (30 min) enrollment token.
2. **Authorized Key Injection**: The script sets up `/root/.ssh/authorized_keys` with Warlock's ECDSA key and secures permissions (`chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys`).
3. **Primary IP Detection**: Automatically determines the primary reachable network interface (`ip -4 route get 1.1.1.1`).
4. **Instant Fleet Enrollment**: Makes an authenticated callback to `POST /api/hosts/enroll`, registering the server into the database and executing post-add prerequisites (e.g. package inspection and firewall preparation).

---

## 5. API Reference

### `GET /api/hosts/enroll-token`
Generates a new enrollment token.
- **Headers**: `Authorization: Bearer <token>`
- **Response**:
  ```json
  {
    "success": true,
    "token": "7b8f9a...",
    "command": "curl -sSL \"http://.../api/hosts/enroll.sh?token=7b8f9a...\" | sudo bash",
    "expiresIn": 1800
  }
  ```

### `GET /api/hosts/enroll.sh?token=<token>`
Returns dynamic bash enrollment bootstrap script.
- **Content-Type**: `text/x-shellscript`

### `POST /api/hosts/enroll`
Script callback endpoint to register newly prepared host.
- **Body**: `{ "token": "7b8f9a...", "ip": "192.168.1.120" }`

### `POST /api/proxmox/test`
Verify Proxmox credentials and cluster connectivity.
- **Body**: `{ "host": "...", "tokenUser": "...", "tokenId": "...", "tokenSecret": "..." }`

### `POST /api/proxmox/nodes`
List cluster nodes and their available container storages.

### `POST /api/proxmox/provision`
Create and start a Debian 12 LXC container with injected SSH keys.
- **Body**:
  ```json
  {
    "host": "https://pve.lan:8006",
    "tokenUser": "root@pam",
    "tokenId": "warlock",
    "tokenSecret": "...",
    "node": "pve1",
    "hostname": "warlock-game-node",
    "storage": "local-lvm",
    "cores": 4,
    "memory": 4096,
    "disk": 30,
    "bridge": "vmbr0"
  }
  ```

### `POST /api/proxmox/community-script`
Generates a customized unattended bash command referencing `community-scripts.org`.
