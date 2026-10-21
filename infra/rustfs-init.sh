#!/bin/sh
# Idempotent RustFS bootstrap, run by the rustfs-init service on every `docker compose up`.
set -eu

rc alias set local "$S3_ENDPOINT_URL" "$RUSTFS_ROOT_USER" "$RUSTFS_ROOT_PASSWORD" --bucket-lookup path >/dev/null

# Private bucket: no anonymous access; objects are only served through the backend.
rc bucket create --ignore-existing "local/$S3_BUCKET"
rc anonymous set private "local/$S3_BUCKET"

# Least-privilege policy: object read/write/delete and listing in this one bucket only.
cat > /tmp/app-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$S3_BUCKET/*"]
    }
  ]
}
POLICY
rc admin policy create local deepref-app /tmp/app-policy.json
rc admin user add local "$S3_ACCESS_KEY" "$S3_SECRET_KEY"
rc admin policy attach local deepref-app --user "$S3_ACCESS_KEY"

echo "Storage ready: bucket '$S3_BUCKET', app user '$S3_ACCESS_KEY'"
