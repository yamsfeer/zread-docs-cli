# zread-docs-cli

从命令行浏览和导出 [zread.ai](https://zread.ai) 上的开源项目文档。

**zread.ai** 是一个分析开源仓库并生成结构化文档（Wiki 页面）的服务。这个 CLI 工具让你可以搜索仓库、列出文档目录、阅读 Markdown 内容，以及批量导出整个 Wiki —— 读取操作不需要认证。

---

## 安装

### 通过 npm（推荐）

```bash
npm install -g zread-docs-cli
```

### 从源码安装

```bash
git clone https://github.com/your-username/zread-docs-cli.git
cd zread-docs-cli
npm install
npm run build
npm link
```

**环境要求：** Node.js >= 18（使用原生 `fetch` API）

---

## 快速开始

```bash
# 搜索仓库
zread-docs find react --limit 5

# 查看仓库信息和索引状态
zread-docs stat facebook/react

# 列出文档目录
zread-docs ls facebook/react

# 阅读指定页面
zread-docs cat facebook/react 1-overview

# 批量导出到本地
zread-docs cp facebook/react ./docs
```

---

## 命令说明

### `find <query>` — 搜索仓库

在 zread.ai 上搜索已被索引的 GitHub 仓库。

```bash
zread-docs find react --limit 10
zread-docs find kubernetes -l en
```

| 选项 | 说明 |
|------|------|
| `--limit <n>` | 最多显示多少条结果（默认 20） |
| `-l, --lang <lang>` | 语言：`zh` 或 `en`（默认自动检测，回退到 `zh`） |

**调用端点：** `GET https://zread.ai/api/v1/repo?q={query}`

---

### `stat <repo>` — 查看仓库信息

显示仓库的基本信息和索引状态。

```bash
zread-docs stat facebook/react
zread-docs stat torvalds/linux -j
```

| 选项 | 说明 |
|------|------|
| `-l, --lang <lang>` | 语言：`zh` 或 `en` |
| `-j, --json` | 以 JSON 格式输出原始数据 |
| `-p, --plain` | 以纯文本输出（无颜色） |

**调用端点：** `GET https://zread.ai/api/v1/repo/github/{owner}/{name}`

---

### `ls <repo>` — 列出文档目录

显示该仓库在 zread.ai 上的文档目录结构（目录大纲）。

```bash
zread-docs ls facebook/react
zread-docs ls golang/go -l en
```

| 选项 | 说明 |
|------|------|
| `-l, --lang <lang>` | 语言：`zh` 或 `en` |

**实现原理：** 这个命令向 `https://zread.ai/{owner}/{repo}` 发送带 `RSC: 1` 头的请求，获取 React Server Component (RSC) 响应流，从中提取嵌入的 JSON 数据，解析出 `wiki.pages` 数组来展示目录结构。

---

### `cat <repo> <slug>` — 阅读文档页面

读取某个文档页面的 Markdown 正文内容。

```bash
zread-docs cat facebook/react 1-overview
zread-docs cat golang/go 1-overview -l en
```

| 选项 | 说明 |
|------|------|
| `-l, --lang <lang>` | 语言：`zh` 或 `en` |

**实现原理：** 请求 `https://zread.ai/{owner}/{repo}/{slug}` 并带上 `RSC: 1` 头。响应体使用一种自定义的二进制分帧格式：

1. 响应末尾包含一个标记 `,---`
2. 标记前有一行形如 `81:T42bf,` 的头部
3. 正则 `^([0-9a-f]+):T([0-9a-f]+),` 匹配出内容字节长度（十六进制）
4. 逗号后的 `byte_length` 个字节即为 UTF-8 编码的 Markdown 内容

工具会自动解析这个格式并输出纯 Markdown。

---

### `cp <repo> [outputDir]` — 批量导出文档

导出该仓库的所有文档页面到本地文件。

```bash
zread-docs cp facebook/react
zread-docs cp golang/go ./docs -c 20
```

| 选项 | 说明 |
|------|------|
| `-l, --lang <lang>` | 语言：`zh` 或 `en` |
| `-c, --concurrency <n>` | 并发下载数量（默认 10） |
| `outputDir` | 输出目录（默认当前目录） |

**输出文件：**
- `{slug}.md` — 每个页面一个 Markdown 文件
- `llms.txt` — 目录索引，使用本地相对链接
- `llms-full.txt` — 完整内容合集，使用远程链接指向 zread.ai

---

## API 端点参考

本工具与 `https://zread.ai` 通信。所有 JSON 响应遵循以下格式：

```json
{ "code": 0, "data": "...", "msg": "..." }
```

`code === 0` 表示成功。

### 端点列表

| 端点 | 方法 | 需认证 | 说明 |
|------|------|--------|------|
| `/api/v1/repo?q={query}` | GET | 否 | 搜索仓库 |
| `/api/v1/repo/github/{owner}/{name}` | GET | 否 | 获取仓库信息和索引状态 |
| `/api/v1/public/repo/trending` | GET | 否 | 每周热榜 |
| `/api/v1/repo/recommend?topic={topic}` | GET | 否 | 推荐仓库 |
| `/api/v1/public/repo/submit` | POST | 否 | 提交 GitHub 仓库进行索引 |
| `/api/v1/repo/{repo_id}/refresh` | POST | 是 | 请求重新索引 |
| `/api/v1/repo/{repo_id}/files` | POST | 是* | 获取仓库内文件内容 |
| `/api/v1/wiki/{wiki_id}/search?q={query}` | GET | 是* | 在 Wiki 内搜索 |
| `/{owner}/{repo}` | GET | 否 | RSC 响应，包含 Wiki 目录 |
| `/{owner}/{repo}/{slug}` | GET | 否 | RSC 响应，包含 Markdown 内容 |

\* 部分端点无需 Token 也可调用，但可能有频率限制。

### 请求头说明

| 请求头 | 值 | 使用场景 |
|--------|-----|----------|
| `User-Agent` | `Mozilla/5.0 (compatible; zread-docs-cli/1.0.0; ...)` | 所有请求 |
| `RSC` | `1` | `ls` 和 `cat` 命令 |
| `X-Locale` / `x-locale` | `zh` 或 `en` | 语言偏好 |
| `Authorization` | `Bearer {token}` | 需要认证的端点 |

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `ZREAD_LANG` | 默认语言（`zh` 或 `en`），优先级低于 `--lang` 选项 |

---

## 许可证

MIT
