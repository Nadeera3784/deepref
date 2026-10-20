#!/usr/bin/env sh
# Runs before the API starts: apply database migrations.
set -e
alembic upgrade head
