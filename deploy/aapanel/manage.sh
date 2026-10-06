#!/bin/sh
set -eu
# aaPanel groups Compose containers by the MD5 of the displayed stack name.
exec /usr/bin/docker-compose -p 705cc8f57d86e799d29f04c4b7f6f22f \
  -f /opt/taskorbit-board/docker-compose.yaml "$@"
