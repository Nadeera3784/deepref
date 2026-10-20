#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null

mc mb --ignore-existing "local/$MINIO_BUCKET"
mc anonymous set none "local/$MINIO_BUCKET"


cat > /tmp/app-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetBucketLocation", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::$MINIO_BUCKET"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::$MINIO_BUCKET/*"]
    }
  ]
}
POLICY
mc admin policy create local deepref-app /tmp/app-policy.json


mc admin user add local "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc admin policy attach local deepref-app --user "$MINIO_ACCESS_KEY" 2>/dev/null \
  || echo "Policy already attached to $MINIO_ACCESS_KEY"

echo "MinIO ready: bucket '$MINIO_BUCKET', app user '$MINIO_ACCESS_KEY'"
