#!/usr/bin/env node

const path = require('path');

// 使用 sucrase 支持 TypeScript 源码运行
require('sucrase/register/ts');

// 加载 TypeScript 入口文件
require(path.resolve(__dirname, './index.ts'));
