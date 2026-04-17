# JB AI Proxy

JetBrains AI 反向代理。把 JetBrains AI 转成 OpenAI、Anthropic、Responses 三种兼容格式，并**直连 JB 官方隐藏的原生端点**，解锁 aggregated 层拿不到的原生特性。

## 功能

- 三种对外协议
  - OpenAI 兼容 `/v1/chat/completions`、`/v1/models`
  - Anthropic 兼容 `/v1/messages`
  - OpenAI Responses 兼容 `/v1/responses`（新）
- 原生透传路径（同家族请求零转换直接转发到 JB `/user/v5/llm/<provider>/...`）
  - Claude 模型：extended thinking（`adaptive`）、prompt caching、signature
  - GPT / o-系列：原生 `response_format`、`logprobs`、`parallel_tool_calls`
  - GPT Responses：`reasoning.effort`、`reasoning.summary`、reasoning output block
  - Codex 系列：通过 `/v1/responses` 原生可用
  - Grok：通过 `/v1/responses` 原生可用
- 聚合层 fallback(跨家族 / Gemini / legacy model) + 格式转换
- 流式和非流式
- 多账号轮询、API Key 鉴权、Web 管理面板

## 支持的模型

`/v1/models` 返回当前账号可用的 JB profile（通常 50+）。主要家族：

- **Anthropic**: Claude 4 Sonnet、4.1 Opus、4.5 Sonnet/Haiku/Opus、4.6 Opus/Sonnet、**4.7 Opus**
- **OpenAI**: GPT-4、4-turbo、4o、4.1 系列、GPT-5 全系列（5/5-mini/5-nano/5.1/5.2/5.4*）、Codex 全系列、o1/o3/o3-mini/o4-mini
- **Google**: Gemini 2.0/2.5/3.0/3.1 的 flash / flash-lite / pro
- **xAI**: Grok-4、Grok-4-fast、Grok-4.1-fast、Grok-code-fast-1

客户端既可以传 JB profile ID（`anthropic-claude-4-7-opus`、`openai-gpt-5-4`），也可以传对应的官方原生 ID（`claude-opus-4-7`、`gpt-5.4`、`gpt-5-2025-08-07` 等带日期 pin 的精确版本）——代理会自动识别并路由。

## 快速开始

```bash
npm install
node server.js
```

打开 `http://localhost:3000/panel` 进管理面板。

## 添加账号

### OAuth 登录
1. 面板点「添加账号」
2. 前往 JetBrains 登录授权
3. 本地：自动回调；远程：复制回调 URL 粘贴到面板
4. 填 License ID（在 [account.jetbrains.com/licenses](https://account.jetbrains.com/licenses) 查看）

### 手动导入
面板点「手动导入」，填 Refresh Token 和 License ID。

## 配置

编辑 `config.json`：

```json
{
  "port": 3000,
  "api_key": "sk-your-key-here",
  "panel_password": "your-password",
  "grazie_agent": {
    "name": "aia:idea",
    "version": "261.22158.366:261.22158.277"
  }
}
```

- `port`: 监听端口
- `api_key`: 留空表示不鉴权
- `panel_password`: 留空表示不需要密码
- `grazie_agent`: 发送给 JetBrains API 的客户端标识

## API 使用

### OpenAI 格式（chat.completions）

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai-gpt-5-4",
    "messages": [{"role": "user", "content": "hi"}],
    "stream": true
  }'
```

GPT / o-系列模型会直接透传到 JB `/openai/v1/chat/completions` 原生端点。跨家族请求（比如用这个端点调 Claude）会 fallback 到聚合层。

### Anthropic 格式（含 extended thinking）

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "x-api-key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic-claude-4-7-opus",
    "max_tokens": 8192,
    "thinking": {"type": "adaptive", "display": "summarized"},
    "messages": [{"role": "user", "content": "Hard question"}]
  }'
```

Claude 模型走原生 `/anthropic/v1/messages`，`thinking` 块、`signature`、`cache_control` 等原生字段全部保留。

### OpenAI Responses 格式（含 reasoning）

```bash
curl -X POST http://localhost:3000/v1/responses \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "Hard question",
    "reasoning": {"effort": "high", "summary": "detailed"}
  }'
```

支持的模型家族：OpenAI（含 Codex 全系列）、xAI Grok。其他家族返回 400——请改用 `/v1/chat/completions` 或 `/v1/messages`。

### 模型列表

```bash
curl -H "Authorization: Bearer sk-your-key" http://localhost:3000/v1/models
```

## 客户端配置

Cherry Studio / ChatGPT-Next-Web / Cursor / Claude Code 等：

- **Base URL**: `http://localhost:3000/v1`
- **API Key**: `config.json` 中配置的 key
- **Model**: 传 JB profile ID（如 `anthropic-claude-4-7-opus`、`google-chat-gemini-flash-2.5`），或 Anthropic/OpenAI 官方原生 ID（如 `claude-opus-4-7`、`gpt-5-2025-08-07`）

## 路由策略

| 对外路由 | 模型家族 | 实际走向 |
|---|---|---|
| `/v1/messages` | Claude | **JB `/anthropic/v1/messages` 原生透传** |
| `/v1/messages` | 其他 | 聚合层 + anthropic-to-jb 转换 |
| `/v1/chat/completions` | GPT / o-系列（非 codex） | **JB `/openai/v1/chat/completions` 原生透传** |
| `/v1/chat/completions` | Codex / 其他 | 聚合层 + openai-to-jb 转换 |
| `/v1/responses` | GPT / Codex / Grok | **JB 对应原生 responses 透传** |
| `/v1/responses` | Claude / Gemini | 400 拒绝 |

Gemini 目前在 JB 没有 native passthrough，全部走聚合层。

## 账号管理

账号凭据保存在 `credentials.json`，自动刷新：

- id_token：每 50 分钟刷新
- JWT：每 20 小时刷新
- 多账号简单轮询

## 项目结构

```
jb-ai-proxy/
  server.js                   # 入口
  config.json                 # 配置
  credentials.json            # 账号凭据（自动生成）
  src/
    config.js                 # 配置加载
    jb-client.js              # JetBrains API 客户端（aggregated + native）
    auth-flow.js              # OAuth PKCE
    account-manager.js        # 账号管理、Token 刷新、轮询
    model-id.js               # JB profile ↔ 原生 ID 映射、family 识别
    converter/                # 聚合层格式转换
      openai-to-jb.js
      jb-to-openai.js
      anthropic-to-jb.js
      jb-to-anthropic.js
      tools.js
      parameters.js           # 聚合层的 provider-specific 参数白名单
    routes/
      openai.js               # /v1/chat/completions, /v1/models
      anthropic.js            # /v1/messages
      responses.js            # /v1/responses
      auth.js                 # OAuth 回调
      panel-api.js            # 管理面板 API
  panel/                      # 管理面板前端
```
