# DSH 插件版备份

`dsh-agent-ping-0.2.0-2026-10-20.zip` 是从本仓库单独整理出来的 **DSH 插件版**快照，
用于留档和独立分发。它不依赖 `standalone/` 里的独立版代码。

## DSH 配套的全局轮盘（已部署）

`main` 分支上的 0.2.0 全局端（只走 DSH 桥接、没有独立 Hub/设置）已经构建并放在：

```text
D:\Mydocument\projects\agent-ping-dsh-global\AgentPing-win32-x64\
```

- 构建方式：`git worktree add ... main`，把稳定副本的 `lib/client.js` 同步到
  `renderer/agent-ping-client.js`，再用本地 Electron 缓存打包；工作树已删除。
- 启动方式：`AgentPing.cmd` 或 `AgentPingCore.exe --no-sandbox`。
- 开机自启：`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Agent Ping.lnk`
  已指向这个 exe，登录后自动在托盘，DSH 打开时它在后台。
- 它就是 DSH 插件款的全局轮盘：只读 `~/.dsh/agent-ping-bridge.json`，不发独立 Hub。

## 稳定安装（开发期间照常使用）

DSH 的 `desktop` profile 现在链接到仓库外的冻结副本：

```text
D:\Mydocument\projects\agent-ping-stable\plugin
```

```json
"dsh-agent-ping": "link:D:/Mydocument/projects/agent-ping-stable/plugin"
```

这样在 `agent_wake` 仓库里继续开发（改 `standalone/`、`global-app/`）**不会**改变你正在用的
DSH 插件。

2026-10-20 晚，稳定副本的 `lib/client.js` 曾被有意同步几次修复（提问选择框可拖动/缩放、
全局模式同样可调、会话选择框可拖动并避开标记框、提问框内置「发送到」选择、全局信号也能选会话），
当前 sha256 为 `5dedb4da…a932f5`，与仓库版本一致。此后除非再次明确要修插件，不再从仓库覆盖。

注意：切换链接后，正在运行的 DSH 进程里 Host 半侧仍是切换前加载的同一份代码（内容相同）；
**重启一次 DSH** 后才会完全从稳定副本加载。重启前请不要改动 `agent_wake/agent-ping/`，
开发工作会集中在 `standalone/` 与新的独立版 UI 上。

| 项 | 值 |
| --- | --- |
| 插件版本 | `dsh-agent-ping@0.2.0` |
| 对应 `main` 提交 | `bd22fd6e3fb31e44517580b80fb232e4f725c52b` |
| 稳定副本 | `D:\Mydocument\projects\agent-ping-stable\plugin` |
| 打包含量 | `dist/dsh-agent-ping-0.2.0.tgz`（sha256 `99e07f6d…072c01`） |
| 备份文件 | `backup/dsh-agent-ping-0.2.0-2026-10-20.zip`（约 85 KB） |

## 压缩包里有什么

```text
dsh-agent-ping-0.2.0/
  INSTALL.md                 # 安装步骤、快捷键、边界
  manifest.json              # 版本、提交、每个文件的 sha256
  source/agent-ping/         # 插件源码（Host 桥接 + 页面轮盘 + preview）
  dist/dsh-agent-ping-0.2.0.tgz
```

安装与恢复步骤见压缩包内的 `INSTALL.md`；`manifest.json` 可以用来校验文件是否被改动。

## 和 standalone 分支的关系

- 这个备份是 **DSH 专用**：通过 `session.prompt()` 往 DSH 当前会话发信号。
- `standalone` 分支是新的独立版（hub + CLI + attach），DSH 只是它未来要接的一个消费者。
- 需要给别的 agent 用时，不要改这个备份，直接用 `standalone/`。

## 重新生成

压缩包不是自动构建产物；如果要重新打一份，按 `manifest.json` 里的文件列表复制
`agent-ping/` 与 `dist/dsh-agent-ping-0.2.0.tgz`，重新计算哈希即可。
