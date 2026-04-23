#!/bin/bash
# Deploys the IoT-Node dashboard to Bee-Docker.
#
# Layout:
#   Local:  <repo>/IoT-Node/dashboard/           (compose + source)
#   Remote: ~/iotnode/dashboard/                 (mirror, excluding data/)
#   Remote: ~/iotnode/dashboard/data/iotnode.db  (persistent SQLite, not rsynced)
#
# The docker-compose volume is "./data:/app/data" so the DB location depends
# ONLY on the compose file directory, not on CWD when docker compose runs.

set -euo pipefail

# Run from the script's own directory so behavior doesn't depend on CWD.
cd "$(dirname "$0")"

REMOTE="Bee-Docker"
REMOTE_ROOT="/home/rhaguiuda/iotnode"
REMOTE_DASHBOARD="$REMOTE_ROOT/dashboard"
DASHBOARD_URL="http://192.168.100.224:3100"

echo "[DEPLOY] Syncing dashboard/ → $REMOTE:$REMOTE_DASHBOARD/"
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude data \
  --exclude .superpowers \
  ./dashboard/ "$REMOTE:$REMOTE_DASHBOARD/"

echo "[DEPLOY] Building and starting containers on $REMOTE..."
ssh "$REMOTE" "cd $REMOTE_DASHBOARD && sudo docker compose up -d --build"

echo "[DEPLOY] Waiting for dashboard to respond..."
for i in $(seq 1 20); do
  if curl -sSf -o /dev/null "$DASHBOARD_URL/" 2>/dev/null; then
    echo "[DEPLOY] Dashboard OK at $DASHBOARD_URL (attempt $i)"
    break
  fi
  sleep 1
  if [ "$i" = "20" ]; then
    echo "[DEPLOY] ERROR: dashboard did not respond after 20s" >&2
    ssh "$REMOTE" "sudo docker ps --filter name=iot-air-quality --format '{{.Names}} {{.Status}}'" >&2 || true
    exit 1
  fi
done

echo "[DEPLOY] Container status:"
ssh "$REMOTE" "sudo docker ps --filter name=iot-air-quality --format '  {{.Names}}  {{.Status}}'"

echo "[DEPLOY] DB file on disk:"
ssh "$REMOTE" "sudo ls -la $REMOTE_DASHBOARD/data/ 2>/dev/null || echo '  (no data dir yet — will be created by container on first write)'"

echo "[DEPLOY] Done."
