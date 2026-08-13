# Coze Orz Monorepo
[![codecov](https://codecov.io/gh/coze-dev/coze-js/graph/badge.svg?token=W5EBMZ0NUE)](https://codecov.io/gh/coze-dev/coze-js) ![ci](https://github.com/coze-dev/coze-js/actions/workflows/ci@main.yml/badge.svg)

[English](./README.md) | 简体中文

## 📦 包列表

本 monorepo 包含以下包：

| 包名 | 描述 | 版本 |
|---------|------------|---------|
| [@coze/api](./packages/coze-js) | Coze API SDK | [![npm](https://img.shields.io/npm/v/@coze/api.svg)](https://www.npmjs.com/package/@coze/api) |
| [@coze/realtime-api](./packages/realtime-api) | 实时语音 SDK | [![npm](https://img.shields.io/npm/v/@coze/realtime-api.svg)](https://www.npmjs.com/package/@coze/realtime-api) |
| [@coze/taro-api](./packages/coze-taro) | 支持 Taro 小程序的 Coze API SDK | [![npm](https://img.shields.io/npm/v/@coze/taro-api.svg)](https://www.npmjs.com/package/@coze/taro-api) |
| [@coze/uniapp-api](./packages/coze-uniapp) | 支持 UniApp 小程序的 Coze API SDK | [![npm](https://img.shields.io/npm/v/@coze/uniapp-api.svg)](https://www.npmjs.com/package/@coze/uniapp-api) |
| [@coze/chat-sdk](./packages/chat-sdk) | 支持 Taro 和 Web 的 Coze 聊天组件 SDK | [![npm](https://img.shields.io/npm/v/@coze/chat-sdk.svg)](https://www.npmjs.com/package/@coze/chat-sdk) |
## 🎮 示例

在 [examples](./examples) 目录中查找每个包的使用示例：

- [coze-js-node](./examples/coze-js-node) - @coze/api 的 Node.js 使用示例
- [coze-js-web](./examples/coze-js-web) - @coze/api 的 React Web 使用示例，[预览](https://coze-js-web-example.surge.sh/)
- [coze-js-taro](./examples/coze-js-taro) - @coze/taro-api Taro4 小程序示例
- [coze-js-taro3](./examples/coze-js-taro3) - @coze/taro-api Taro3 小程序示例
- [coze-js-uniapp](./examples/coze-js-uniapp) - UniApp(V3) 小程序示例
- [coze-js-uniapp-v2](./examples/coze-js-uniapp-v2) - UniApp(V2) 小程序示例
- [realtime-console](./examples/realtime-console) - @coze/realtime-api 完整版实时语音示例，[预览](https://coze.cn/open-platform/realtime/playground)
- [realtime-call-up](./examples/realtime-call-up) - @coze/realtime-api 简化版实时语音示例
- [realtime-quickstart-react](./examples/realtime-quickstart-react) - @coze/realtime-api 快速入门 React 示例
- [realtime-quickstart-vue](./examples/realtime-quickstart-vue) - @coze/realtime-api 快速入门 Vue 示例
- [quickstart-oauth-server](./examples/quickstart-oauth-server) - Coze SDK OAuth 示例
- [realtime-websocket](./examples/realtime-websocket) - @coze/api/ws-tools 的 Websocket 实时语音、语音合成、语音识别示例
- [simult-extension](./examples/simult-extension) - @coze/api/ws-tools 的同声传译示例
- [fact-check-extension](./examples/fact-check-extension) - 基于 @coze/api 的浏览器事实核查扩展示例

## 🚀 快速开始

### 前置要求

- Node.js 18+ (推荐 LTS/Hydrogen)
- pnpm 9.12.3
- Rush 5.140.0

### 安装步骤

1. **安装 Node.js 18+**

```bash
nvm install lts/hydrogen
nvm alias default lts/hydrogen # 设置默认 node 版本
nvm use lts/hydrogen
```

2. **克隆仓库**

```bash
git clone git@github.com:coze-dev/coze-js.git
```

3. **安装必需的全局依赖**

```bash
npm i -g pnpm@9.12.3 @microsoft/rush@5.140.0
```

4. **安装项目依赖**

```bash
rush update
```

5. **构建项目**

```bash
rush build
```

完成上述步骤后，你就可以开始在这个仓库中进行开发了。

开始享受开发吧！

## 🔨 开发

此 monorepo 中的每个包都可以独立开发和发布。开始开发：

1. 进入包目录：

```bash
cd packages/<package-name>
```

2. 启动开发：

```bash
npm run start
```

## 📖 文档

- [官方文档](https://www.coze.cn/docs/developer_guides/nodejs_overview)
- [贡献指南](./CONTRIBUTING.md)
- [如何发布](./docs/publish.md)

## 📄 许可证

[MIT](./LICENSE)
