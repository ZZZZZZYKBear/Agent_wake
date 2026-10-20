# DSH 插件版备份

`dsh-agent-ping-0.2.0-2026-10-20.zip` 是从本仓库单独整理出来的 **DSH 插件版**快照，
用于留档和独立分发。它不依赖 `standalone/` 里的独立版代码。

| 项 | 值 |
| --- | --- |
| 插件版本 | `dsh-agent-ping@0.2.0` |
| 对应 `main` 提交 | `bd22fd6e3fb31e44517580b80fb232e4f725c52b` |
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
