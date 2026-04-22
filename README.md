# JB AI Proxy

JetBrains AI 反向代理，将 JetBrains AI API 转换为 OpenAI、Anthropic、OpenAI Responses 兼容格式。

底层路由到 JB 两类端点（公共前缀 `/user/v5/llm/`）：

- **聚合层** `chat/stream/v8`、`responses/stream/v8`：JB 自定义 profile 格式，所有 model 可用但丢 thinking / reasoning 等原生特性。（Gemini模型只有聚合层）
- **原生透传**  `anthropic/v1/messages`、`openai/v1/chat/completions`、`openai/v1/responses`、`xai/v1/responses`：JB 不公开但实测可用的路径，按各家官方 API 协议零转换。Claude / OpenAI / Grok 同协议请求自动走原生。

## 功能

- OpenAI 兼容接口（`/v1/chat/completions`、`/v1/models`）
- Anthropic 兼容接口（`/v1/messages`）
- OpenAI Responses 兼容接口（`/v1/responses`）
- 同家族请求直连 JB 原生端点透传，保留 extended thinking、reasoning summary、prompt caching 等原生特性
- 流式和非流式响应
- 多轮对话、工具调用（Function Calling）、图片输入
- 多账号轮询
- API Key 鉴权
- Web 管理面板

## 支持的模型

通过 JetBrains AI 可使用 50+ 模型，包括：

- **OpenAI**: GPT-4o, GPT-4.1, GPT-5 系列, Codex 系列, o1/o3/o4-mini
- **Anthropic**: Claude 4 Sonnet, Claude 4.5 系列, Claude 4.6 Opus/Sonnet, Claude 4.7 Opus
- **Google**: Gemini 2.0/2.5/3.x Flash/Pro
- **xAI**: Grok-4, Grok-4.1 Fast

## 快速开始

```bash
# 安装依赖
npm install

# 启动
node server.js
```

打开 `http://localhost:3000/panel` 进入管理面板。

## Docker 部署

### 快速启动

```bash
# 确保 config.json 存在（首次部署可使用默认配置）
cp config.json config.json.bak 2>/dev/null || true

# 确保 credentials.json 存在（容器会自动写入）
touch credentials.json

# 构建并启动
docker compose up -d

# 查看日志
docker compose logs -f
```

管理面板：`http://localhost:3000/panel`

### 配置方式

**方式一：编辑 config.json（推荐）**

直接编辑 `config.json`，通过 volume 挂载到容器中：

```json
{
  "port": 3000,
  "api_key": "sk-your-key",
  "panel_password": "your-password",
  "grazie_agent": {
    "name": "aia:idea",
    "version": "261.22158.366:261.22158.277"
  }
}
```

**方式二：环境变量覆盖**

环境变量优先级高于 `config.json`：

```bash
# 通过命令行
API_KEY=sk-xxx PANEL_PASSWORD=secret docker compose up -d

# 或创建 .env 文件
echo 'API_KEY=sk-xxx' > .env
echo 'PANEL_PASSWORD=secret' >> .env
docker compose up -d
```

支持的环境变量：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 宿主机映射端口 | `3000` |
| `API_KEY` | API 密钥（覆盖 config.json） | 空 |
| `PANEL_PASSWORD` | 面板密码（覆盖 config.json） | 空 |

### 自定义端口

```bash
# 修改宿主机映射端口
PORT=8080 docker compose up -d
```

> **注意**：`config.json` 中的 `port` 值必须与 docker-compose 映射的容器内端口一致（默认 3000），否则健康检查和 OAuth 回调会失败。

### Docker 环境下添加账号

OAuth 回调 URL 固定为 `http://localhost:{port}`，**不做修改**以避免被 JetBrains 官方封禁。

- **本地部署**：浏览器自动回调，与非 Docker 使用方式完全一致
- **远程部署**：在管理面板上使用以下两种方式之一：
  1. 「添加账号」→ 在本地浏览器打开授权链接 → 授权后复制回调 URL → 粘贴到面板提交
  2. 「手动导入」→ 直接填入 Refresh Token 和 License ID

### 常用命令

```bash
docker compose up -d              # 后台启动
docker compose down                # 停止并移除容器
docker compose logs -f             # 查看实时日志
docker compose restart             # 重启
docker compose build --no-cache    # 重新构建镜像
```

## 添加账号

### 方式一：OAuth 登录

1. 在管理面板点击「添加账号」
2. 点击链接前往 JetBrains 登录授权
3. 本地部署：授权后自动回调；远程部署：复制回调 URL 粘贴到面板
4. 填写 License ID（在 [account.jetbrains.com/licenses](https://account.jetbrains.com/licenses) 页面查看）
5. 提交完成

### 方式二：手动导入

在管理面板点击「手动导入」，填入 Refresh Token 和 License ID。

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
- `api_key`: API 密钥，留空表示不鉴权
- `panel_password`: 管理面板密码，留空表示不需要密码
- `grazie_agent`: 发送给 JetBrains API 的客户端标识

环境变量 `API_KEY`、`PANEL_PASSWORD`、`PORT` 可覆盖对应配置项（Docker 部署时尤其方便）。

## API 使用

### OpenAI 格式

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic-claude-4-7-opus",
    "messages": [{"role": "user", "content": "hello"}],
    "stream": true
  }'
```

### Anthropic 格式（含 extended thinking）

```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "x-api-key: sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic-claude-4-7-opus",
    "max_tokens": 8192,
    "thinking": {"type": "adaptive", "display": "summarized"},
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

Claude 家族走原生透传，`thinking`、`signature`、`cache_control` 等字段原样保留。

### OpenAI Responses 格式（含 reasoning）

```bash
curl -X POST http://localhost:3000/v1/responses \
  -H "Authorization: Bearer sk-your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "input": "hello",
    "reasoning": {"effort": "high", "summary": "detailed"}
  }'
```

支持 OpenAI（含 Codex 全系列）和 xAI Grok。

### 模型列表

```bash
curl -H "Authorization: Bearer sk-your-key" http://localhost:3000/v1/models
```

## 客户端配置

在 Cherry Studio、ChatGPT-Next-Web、Cursor 等客户端中：

- **Base URL**: `http://localhost:3000/v1`
- **API Key**: `config.json` 中配置的 key
- **Model**: 使用 JetBrains profile ID，如 `anthropic-claude-4-7-opus`、`google-chat-gemini-flash-2.0`；也支持直接传官方原生 ID（`claude-opus-4-7`、`gpt-5.4` 等）

## 账号管理

账号凭据保存在 `credentials.json`，包含 refresh_token 和 JWT，自动刷新：

- id_token：每 50 分钟刷新
- JWT：每 20 小时刷新
- 多账号简单轮询（Round-Robin）

## 项目结构

```
jb-ai-proxy/
  server.js                 # 入口
  config.json               # 配置
  credentials.json          # 账号凭据（自动生成）
  Dockerfile                # Docker 镜像构建
  docker-compose.yml        # Docker Compose 编排
  .dockerignore             # Docker 构建排除
  src/
    config.js               # 配置加载（支持环境变量覆盖）
    jb-client.js            # JetBrains API 客户端（聚合 + 原生）
    auth-flow.js            # OAuth PKCE
    account-manager.js      # 账号管理、Token 刷新、轮询
    model-id.js             # JB profile ID ↔ 原生 ID 映射、family 识别
    converter/              # 聚合层格式转换
      openai-to-jb.js
      jb-to-openai.js
      anthropic-to-jb.js
      jb-to-anthropic.js
      tools.js
      parameters.js         # 聚合层 provider-specific 参数白名单
    routes/
      openai.js             # /v1/chat/completions, /v1/models
      anthropic.js          # /v1/messages
      responses.js          # /v1/responses
      _native-proxy.js      # 原生透传共享 helper
      auth.js               # OAuth 回调
      panel-api.js          # 管理面板 API
  panel/                    # 管理面板前端
```
