#!/bin/bash

set -e

echo "📊 Running all tests with coverage..."

# Unit tests
echo "Running unit tests..."
pnpm vitest --run --coverage

# E2E tests
echo "Running E2E tests..."
bash scripts/e2e.sh

echo "✅ All tests completed!"
