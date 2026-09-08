#!/usr/bin/env bash
set -euo pipefail

# Frontend Post-Deployment Health Check Script
# Usage: ./scripts/frontend-health-check.sh [FRONTEND_URL]

TARGET_URL="${1:-https://www.sgrhivfcryo.in}"

if [ -z "${TARGET_URL}" ]; then
  echo "Error: No frontend URL provided."
  echo "Usage: $0 <FRONTEND_URL>"
  exit 1
fi

echo "🌐 Checking frontend health at: ${TARGET_URL}"

TEMP_FILE=$(mktemp)
trap 'rm -f "${TEMP_FILE}"' EXIT

HTTP_STATUS=$(curl -s -S -L -o "${TEMP_FILE}" -w "%{http_code}" -m 15 "${TARGET_URL}" || echo "000")

echo "HTTP Status: ${HTTP_STATUS}"

if [ "${HTTP_STATUS}" -lt 200 ] || [ "${HTTP_STATUS}" -ge 400 ]; then
  echo "❌ Frontend health check failed with status code ${HTTP_STATUS}."
  exit 1
fi

# Verify that the response body contains valid HTML markup
if grep -qi "<html\|<!doctype html" "${TEMP_FILE}"; then
  echo "✅ Frontend health check passed successfully (HTTP ${HTTP_STATUS}, valid HTML response)."
  exit 0
else
  echo "❌ Frontend health check failed: Response body does not contain valid HTML."
  exit 1
fi
