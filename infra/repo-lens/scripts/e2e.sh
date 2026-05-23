#!/bin/bash

set -e

echo "🧪 Running E2E tests..."

# 设置测试环境
export NODE_ENV=test

# 运行 E2E 测试
pnpm vitest --run --config vitest.e2e.config.ts

echo "✅ E2E tests passed!"
