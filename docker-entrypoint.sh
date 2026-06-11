#!/bin/sh
set -e
# UPLOAD_DIR: absolute or relative to /app (see config UPLOAD_DIR).
UPLOAD_DIR="${UPLOAD_DIR:-/app/uploads}"
case "$UPLOAD_DIR" in
 /*) ;;
 *) UPLOAD_DIR="/app/$UPLOAD_DIR" ;;
esac
mkdir -p "$UPLOAD_DIR"
chown -R apiuser:nodejs "$UPLOAD_DIR"


exec su-exec apiuser "$@"