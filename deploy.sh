#!/bin/bash
set -e

REMOTE="Bee-Docker"
REMOTE_DIR="/home/rhaguiuda/iotnode"

echo "[DEPLOY] Syncing files to $REMOTE..."
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .pio \
  --exclude dist \
  --exclude data \
  --exclude .superpowers \
  ./ "$REMOTE:$REMOTE_DIR/"

echo "[DEPLOY] Building and starting containers..."
ssh "$REMOTE" "cd $REMOTE_DIR/dashboard && sudo docker compose up -d --build"

echo "[DEPLOY] Done. Dashboard at http://192.168.100.224:3100"
