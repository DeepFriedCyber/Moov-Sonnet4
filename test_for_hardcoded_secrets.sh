#!/bin/bash

# This script checks for insecure fallback values in docker-compose.yml
# It looks for patterns like: VARIABLE:-insecure_value

echo "Checking for hardcoded secrets in docker-compose.yml..."

# The grep command will exit with status 0 if a match is found, and 1 otherwise.
# We consider finding a match to be a failure.
if grep -E 'POSTGRES_PASSWORD:-|JWT_SECRET:-' docker-compose.yml; then
    echo "FAIL: Found hardcoded secret fallbacks. Please move them to a .env file."
    exit 1
else
    echo "PASS: No hardcoded secret fallbacks found."
    exit 0
fi