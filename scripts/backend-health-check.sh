#!/usr/bin/env bash
set -euo pipefail

# Backend Post-Deployment Health Check Script
# Usage: ./scripts/backend-health-check.sh [BACKEND_URL]

TARGET_URL="${1:-https://api.sgrhivfcryo.in/api/health}"

if [ -z "${TARGET_URL}" ]; then
  echo "Error: No backend URL provided."
  echo "Usage: $0 <BACKEND_URL>"
  exit 1
fi

echo "📡 Checking backend health at: ${TARGET_URL}"

TEMP_FILE=$(mktemp)
trap 'rm -f "${TEMP_FILE}"' EXIT

HTTP_STATUS=$(curl -s -S -o "${TEMP_FILE}" -w "%{http_code}" -m 15 "${TARGET_URL}" || echo "000")

echo "HTTP Status: ${HTTP_STATUS}"

if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 400 ]; then
  echo "✅ Backend health check passed successfully (HTTP ${HTTP_STATUS})."
  exit 0
else
  echo "❌ Backend health check failed with status code ${HTTP_STATUS}."
  exit 1
fi
