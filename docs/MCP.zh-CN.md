# 将 AI 代理连接到 TaskOrbit

[English](MCP.md) · [فارسی](MCP.fa.md) · [العربية](MCP.ar.md) · [简体中文](MCP.zh-CN.md)

MCP 允许代理读取和管理您自托管服务器上的团队工作。TaskOrbit 本身不会安装模型或自动发送信息给 AI 服务；您连接的代理会收到其工具所请求的数据。

## 1. 创建令牌

登录您的服务器，打开 **设置 → AI 集成 · MCP**。填写名称和有效天数（1–365，默认 30）。建议先使用只读权限。需要创建或编辑任务时启用编辑。实例管理是管理员可单独授予的权限，会允许访问整个服务器；不启用时管理员令牌也受其工作区成员身份限制。

点击 **创建令牌**，立即复制并保存在代理的私人配置中。令牌只显示一次，服务器仅保存 SHA-256 哈希。丢失后应撤销并重新创建。不要提交到 Git。用户当前角色仍然有效：查看者即使使用写入令牌也不能编辑。密码更改/重置以及禁用账户会撤销令牌；普通退出登录不会，需主动点击 **撤销**。

## 2. 选择连接方式

远程 Streamable HTTP 地址是 `https://tasks.example.com/mcp`，需要支持 Bearer 请求头的客户端，无需安装 Node.js。本地 stdio 桥接需要代理设备上的 Node.js ≥22.18，以及首次安装软件包的网络。桥接的 TASKORBIT_SERVER 使用根地址，不含 `/mcp` 或 `/api`。替换为您的服务器域名。HTTP 仅允许 localhost 开发使用。无需额外 Docker 容器；APP_ORIGIN 应匹配公共 HTTPS 地址，反向代理需保留 Host。

### Codex

在启动代理的环境中设置私人 TASKORBIT_TOKEN。PowerShell：`$env:TASKORBIT_TOKEN = 'YOUR_TOKEN'`；macOS/Linux：`export TASKORBIT_TOKEN='YOUR_TOKEN'`。这仅影响当前终端及其子进程；从桌面菜单启动时，请配置操作系统用户环境变量或从该终端启动应用。完全重启应用后，在私人 `~/.codex/config.toml` 添加：

```toml
[mcp_servers.taskorbit]
url = "https://tasks.example.com/mcp"
bearer_token_env_var = "TASKORBIT_TOKEN"
```

无需 OAuth 登录。[官方参考](https://developers.openai.com/codex/mcp/)。

### Cursor

设置环境变量后，将以下内容合并到私人 `~/.cursor/mcp.json`，保留现有服务器并重启应用：

```json
{
  "mcpServers": {
    "taskorbit": {
      "url": "https://tasks.example.com/mcp",
      "headers": { "Authorization": "Bearer ${env:TASKORBIT_TOKEN}" }
    }
  }
}
```

[Cursor 官方指南](https://cursor.com/docs/mcp)。

### Claude Code

将以下条目合并到个人 `~/.claude.json` 或使用环境变量的 `.mcp.json`；重启并通过 `/mcp` 检查：

```json
{
  "mcpServers": {
    "taskorbit": {
      "type": "http",
      "url": "https://tasks.example.com/mcp",
      "headers": { "Authorization": "Bearer ${TASKORBIT_TOKEN}" }
    }
  }
}
```

[官方指南](https://code.claude.com/docs/en/mcp)。

### Claude Desktop 和 stdio 客户端

安装 Node.js，打开 **Settings → Developer → Edit Config**，合并此 JSON。在私人文件中替换 YOUR_TOKEN，不要提交到仓库：

```json
{
  "mcpServers": {
    "taskorbit": {
      "command": "npx",
      "args": [
        "-y",
        "--package=https://github.com/sajadjanat/taskorbit/releases/download/v0.2.0/taskorbit-mcp-0.2.0.tgz",
        "taskorbit-mcp"
      ],
      "env": {
        "TASKORBIT_SERVER": "https://tasks.example.com",
        "TASKORBIT_TOKEN": "YOUR_TOKEN"
      }
    }
  }
}
```

**Windows**：将 command 改为 cmd，在 args 前添加 `"/c", "npx"`。应用内指南提供两个系统的示例。node/npm/npx 必须在客户端 PATH 中，安装后应完全重启。若首次下载超过启动超时，先运行 `npm install -g <上述软件包地址>`，再使用已安装可执行文件的完整路径作为 command，移除 args。

可通过 TASKORBIT_TOKEN_FILE 指定私人 UTF-8 文件的绝对路径，文件仅包含令牌并仅允许当前系统用户读取。它优先于 TASKORBIT_TOKEN，桥接只在启动时读取。软件包在 [GitHub Releases](https://github.com/sajadjanat/taskorbit/releases) 发布，使用 SHA256SUMS 校验；其中不包含数据库或凭据。

## 3. 验证与使用

要求代理：**“使用 TaskOrbit 列出我的工作区。”** 应调用 list_workspaces。先选择工作区和项目，再编辑；删除和服务器升级前要求确认。完整管理员目录有 48 个工具，涵盖工作区、项目、成员、任务/子任务、优先级、标签、估算、迭代、模块、页面、视图、评论、活动、文件、关系、用户、导出和升级。只读或非管理员令牌会显示较少工具。getting_started 提示也可用。迭代完成受支持；删除迭代及编辑/删除评论尚未实现。

任务/页面更新需要先前读取的版本，409 会阻止覆盖新修改。列表支持 limit（1–200，默认 50）与 offset。每个文件最大 10 MiB，每任务最多 20 个文件；内容下载默认限定 64 KiB。代理的修改通过实时事件同步到网页和客户端。

| 问题               | 解决办法                                                             |
| ------------------ | -------------------------------------------------------------------- |
| 401                | 检查令牌、有效期、撤销状态和服务器；登录 Cookie 不是 MCP 令牌。      |
| 403                | 检查令牌权限及用户工作区角色。                                       |
| 缺少编辑工具       | 创建允许编辑的令牌，然后重启代理。                                   |
| 409                | 读取当前版本，合并修改后重试。                                       |
| 429                | 等待后再试，避免循环请求。                                           |
| 无法连接           | 检查 HTTPS、证书、网络和 APP_ORIGIN；桥接使用根地址，远程使用 /mcp。 |
| 浏览器返回 405     | 正常：/mcp 仅接收协议 POST，不是网页。                               |
| 找不到 npx         | 安装 Node.js，检查 PATH 和 Windows 命令示例。                        |
| 客户端仅支持 OAuth | 使用 stdio 或支持 Bearer 的客户端；本版本不支持 OAuth。              |

本版本支持 stdio 与无状态 Streamable HTTP JSON 响应，不支持旧 HTTP+SSE、OAuth 或服务器主动 MCP 通知。两种协议已用官方 SDK 验证；尚未在真实设备上逐一验证各第三方应用界面。[完整英文说明](MCP.md)。
