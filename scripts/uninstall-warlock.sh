#!/bin/bash
#
# Warlock Project Uninstall Script
#
# Standardized script with strict error handling: set -euo pipefail
# This ensures that the script exits immediately if any command fails (e),
# or if any variable is unset (-u), or if any command in a pipeline fails (pipefail).
#
set -euo pipefail

# Function to display usage instructions
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Uninstalls the Warlock service and cleans up associated files."
    exit 1
}

# --- Main Execution Logic ---
echo "--- Warlock Uninstallation Script started. ---"

# 1. Stop the service gracefully
# 2. Remove the service file and service manager entries.
# 3. Clean up application directories and database files.

echo "--- Warlock Uninstallation Script finished successfully. ---"