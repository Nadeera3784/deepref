#!/bin/sh

set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

count=0
for path in /old/*/*.pdf; do
  [ -e "$path" ] || continue
  owner=$(basename "$(dirname "$path")")
  file=$(basename "$path")
  mc cp --quiet "$path" "local/$MINIO_BUCKET/users/$owner/documents/$file"
  count=$((count + 1))
done
echo "Imported $count file(s) into bucket '$MINIO_BUCKET'"
