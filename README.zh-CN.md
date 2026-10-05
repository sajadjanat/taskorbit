<p align="center"><a href="README.md">English</a> · <a href="README.fa.md">فارسی</a> · <a href="README.ar.md">العربية</a> · <strong>简体中文</strong></p>

<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/taskorbit-wordmark-v5-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/taskorbit-wordmark-v5-light.png" />
    <img src="assets/brand/taskorbit-wordmark-v5-light.png" alt="TaskOrbit — transparent sunlit Mercury wordmark" width="680" />
  </picture>
  <h1>TaskOrbit</h1>
  <p><strong>让项目、迭代和团队工作在清晰的轨道上推进。</strong></p>
  <p>采用 React、shadcn/ui 和 Tauri 的轻量自托管项目管理应用。</p>
  <p>
    <a href="https://github.com/sajadjanat/taskorbit/actions/workflows/verify.yml"><img src="https://github.com/sajadjanat/taskorbit/actions/workflows/verify.yml/badge.svg" alt="Web and server checks" /></a>
    <a href="https://github.com/sajadjanat/taskorbit/releases"><img src="https://img.shields.io/badge/version-0.1.6-b88645" alt="Version 0.1.6" /></a>
    <img src="https://img.shields.io/badge/Tauri-2-24c8db?logo=tauri&amp;logoColor=white" alt="Tauri 2" />
    <img src="https://img.shields.io/badge/UI-shadcn%2Fui-18181b?logo=shadcnui&amp;logoColor=white" alt="shadcn/ui" />
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-b88645" alt="MIT license" /></a>
  </p>
  <p><a href="#download">下载</a> · <a href="#features">功能</a> · <a href="#quick-start">快速开始</a> · <a href="#updates">更新</a> · <a href="docs/OPERATIONS.md">Docker</a></p>
</div>

![TaskOrbit Kanban workspace with the Mercury dark theme](docs/images/taskorbit-board-dark.png)

*截图来自实际应用，使用临时示例项目和虚构账户，不包含个人数据。应用界面目前支持波斯语和英语。*

## 为什么选择 TaskOrbit？

清楚了解计划中的工作、下一步负责人和已准备交付的成果。TaskOrbit 把项目、迭代和任务集中在简洁的界面中，数据保存在你掌控的服务器上。从一个应用容器和 SQLite 开始，通过网页、桌面、Android 或 iPhone PWA 连接。

轻量、可自托管的团队项目、迭代和任务管理工具。TaskOrbit 是采用 MIT 许可证的独立团队项目管理应用。当前版本为早期预览；下文介绍已实现的功能和待完成的工作。

<a id="features"></a>

## 功能

| 功能 | 用途 |
| --- | --- |
| **项目与工作区** | 多工作区、多项目，支持项目标识、颜色和归档。 |
| **迭代** | 迭代目标、日期、计划/进行中/已完成状态及进度。 |
| **工作视图** | 可拖拽的看板、可搜索列表，以及按截止日期显示的时间线。 |
| **任务详情** | 任务描述、优先级、负责人、迭代、模块、估算、截止日期和标签。 |
| **任务关系** | 子任务、关联任务和阻塞依赖，并防止依赖循环。 |
| **协作** | 评论、活动历史和附件；单个附件最多 10 MB，每个任务最多 20 个。 |
| **项目知识** | 模块、纯文本项目文档和共享的已保存筛选条件。 |
| **团队管理** | 实例管理员、用户创建/停用/密码重置，以及工作区管理员/成员/只读查看者角色。 |
| **语言与外观** | 波斯语和英语界面，RTL/LTR 布局、本地字体，以及水星石灰色与太阳金色的明暗主题。 |
| **网页与PWA** | 网页应用及 iPhone/iPad PWA，包含断线提示页；编辑需要联网。 |
| **原生客户端** | Windows、macOS、Linux、Android Tauri 客户端，可配置自己的自托管服务器地址。 |
| **轻量服务器** | 一个服务器容器和持久化 SQLite 卷；无需 Redis、消息队列或独立数据库服务。 |
| **应用和服务器更新** | 签名桌面更新、Android APK 检查、网页/PWA 重新加载，以及带备份和失败回滚的可选一键服务器升级。 |

README 提供四种语言；当前应用界面仅支持波斯语和英语。

<details>
<summary><strong>项目概览、浅色主题和波斯语界面</strong></summary>

![TaskOrbit project progress and active sprint](docs/images/taskorbit-overview-dark.png)

![TaskOrbit light theme with stone surfaces and gold accents](docs/images/taskorbit-board-light.png)

![TaskOrbit Persian RTL workspace](docs/images/taskorbit-fa-board.png)

</details>

<a id="download"></a>

## 下载

[**TaskOrbit 0.1.6 → GitHub Releases**](https://github.com/sajadjanat/taskorbit/releases/tag/v0.1.6)

| 平台 | 安装包或访问方式 | 更新方式 |
| --- | --- | --- |
| Windows x64 | TaskOrbit_0.1.6_x64-setup.exe | 应用内签名更新 |
| macOS Apple Silicon | TaskOrbit_0.1.6_aarch64.dmg | 应用内签名更新 |
| macOS Intel | TaskOrbit_0.1.6_x64.dmg | 应用内签名更新 |
| Linux x64 | DEB / AppImage | 应用内签名更新 |
| Android arm64 | taskorbit-android-arm64.apk | 签名 APK；需用户批准安装 |
| Web / iPhone / iPad | 浏览器 / 添加到主屏幕 | 服务器升级后重新加载 |

<a id="quick-start"></a>

## 快速开始

1. 按下方说明使用 Docker 启动服务器。
2. 创建首位管理员和工作区；没有默认密码。
3. 在管理面板创建用户，再将成员及其角色加入团队。
4. 创建项目和迭代，添加负责人、优先级和截止日期明确的任务。
5. 使用看板、列表或时间线跟进工作。
6. 将设备连接到同一 HTTPS 服务器，并选择语言及明暗主题。

## 本地自托管：一个容器

```sh
git clone https://github.com/sajadjanat/taskorbit.git
cd taskorbit
docker compose up -d --build
```

打开 `http://localhost:4310`，创建首位管理员和工作区。没有默认密码；首位管理员创建后关闭公开注册。管理员创建用户，再从 **Team** 添加到工作区。权限边界是工作区：成员可以查看该工作区的所有项目。

使用已发布的公共镜像：

```sh
docker compose -f compose.image.yaml up -d
```

镜像 `ghcr.io/sajadjanat/taskorbit:v0.1.6` 支持 Linux amd64 和 arm64。SQLite、账户及附件保存在 `taskorbit-data` 卷中。`docker compose down -v` 会删除此卷及其数据。

## 公共 HTTPS 服务器：两个容器

将域名指向服务器，开放 80 和 443 端口，并创建 `.env`：

```dotenv
TASKORBIT_DOMAIN=tasks.example.com
```

```sh
docker compose -f compose.yaml -f compose.https.yaml up -d --build
```

第二个容器是 Caddy，用于获取 TLS 证书并代理请求。使用公共镜像时，将 `compose.yaml` 换成 `compose.image.yaml`。也可使用已有反向代理，只运行应用容器，设置 `APP_ORIGIN=https://tasks.example.com` 和 `NODE_ENV=production`。origin 必须与浏览器地址一致。应用默认仅绑定 Docker 主机的 loopback 地址。请在所有者准备创建管理员后再公开首次初始化页面。

<a id="updates"></a>

## 更新

实例管理员可在管理面板检查新版本。拉取镜像后运行 `docker compose -f compose.image.yaml -f compose.updates.yaml up -d`，即可启用带数据库备份和失败自动回滚的一键服务器升级。这会增加一个更新容器：共两个容器，使用 Caddy 时共三个。0.1.3 起桌面客户端在本地连接页提供签名更新，可通过 **Updates / Server connection** 菜单返回。Android 下载新的签名 APK，并需要用户批准安装。服务器升级后，网页和 iPhone PWA 提示重新加载。更早的客户端需先手动安装一次 0.1.6。参阅 [更新指南](docs/UPDATES.md)。


## 安装到设备

从 [Releases](https://github.com/sajadjanat/taskorbit/releases) 下载 Windows x64 安装程序、macOS Intel/Apple Silicon DMG、Linux x64 DEB/AppImage 或 Android arm64 APK。每次启动都会打开连接页面。输入自己服务器的 HTTPS 根地址，例如 `https://tasks.example.com`，然后登录。客户端会记住地址；连接页面不会保存密码。重新启动客户端可选择其他服务器。HTTP 仅用于 localhost 开发。

在 **iPhone/iPad** 上，用 Safari 打开服务器，选择 Share → **Add to Home Screen**。PWA 使用同一服务器和账户，需要 HTTPS。Service Worker 只缓存公开图标和断线页面，不缓存私有工作数据。尚不支持离线同步。

预览版 Windows/macOS 安装包没有代码签名，macOS 未经过 notarization。Android APK 使用项目固定发布密钥签名。本版本不包含 App Store/Play Store 上架。安装包构建成功不代表已在真实设备上验证安装。

## 开发与测试

需要 Node.js 22.18 或更新版本：

```sh
npm ci
npm run dev
```

开发地址为 `http://localhost:5173`，开发 API 应设置 `APP_ORIGIN=http://localhost:5173`。运行构建后的服务器：

```sh
npm run build
npm start
```

默认值：`PORT=4310`、`HOST=127.0.0.1`、`DATABASE_PATH=data/taskorbit.sqlite`。

```sh
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

测试使用临时数据库，不修改 `data/`。无法下载 Playwright 浏览器时，可使用已安装的 Chrome：`PLAYWRIGHT_CHANNEL=chrome npx playwright test --project=chromium`；PowerShell 先设置 `$env:PLAYWRIGHT_CHANNEL='chrome'`。移动尺寸的 WebKit 测试不等于真实 iPhone 测试。

安装 [Tauri 前置依赖](https://v2.tauri.app/start/prerequisites/)，再运行 `npm run desktop`。在目标系统构建：Windows 使用 `npm run desktop:build -- --bundles nsis`，macOS 使用 `--bundles dmg`，Linux 使用 `--bundles deb,appimage`。Android 需要 Java 17、SDK/NDK，执行 `npx tauri android init` 后再执行 `npx tauri android build --apk --target aarch64`。

## 备份与运维

管理员 JSON 导出包含工作数据和用户信息，但不包含密码哈希、会话及附件内容，因此不能作为完整恢复备份。完整备份应先停止 TaskOrbit，归档 `/data` 卷，再重新启动。参阅 [运维文档](docs/OPERATIONS.md)。附件以 BLOB 保存于 SQLite；在数据库写入期间直接复制文件，若不使用 SQLite 备份 API，并不安全。

Compose 将资源限制为 512 MB 内存和一个 CPU；这些是上限，不是实测空闲内存。SQLite WAL 面向小团队及单服务器实例。不要让多个副本共用网络挂载或共享数据库文件。

## 发布与范围

标签 `v0.1.6` 会触发验证、原生打包、多架构镜像及发布草稿。所有平台构建成功后才发布。参阅 [发布说明](docs/RELEASE-NOTES.md)、[验证记录](docs/VERIFICATION.md) 和 [路线图](docs/ROADMAP.md) 了解限制与后续工作。

技术栈：React、TypeScript、Vite、Tailwind、真正的 shadcn/ui 源组件、Express、Node 内置 SQLite API 和 Tauri 2。Vazirmatn 字体采用 OFL 许可证。品牌采用受阳光照亮的水星、石色/炭色背景和金色强调；[品牌详情](assets/brand/WORDMARK.md)。

## 许可证

MIT。组件源码和依赖保留其原始许可证，参见 [第三方声明](THIRD-PARTY-NOTICES.md)。
