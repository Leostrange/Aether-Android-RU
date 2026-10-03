<p align="center">
  <img src="app/src/main/res/drawable-nodpi/aether_mark.png" width="128" height="128" alt="Aether Logo">
</p>

<h1 align="center">Aether | 扶摇</h1>

<p align="center">
  <strong>Soar with local AI.</strong><br>
  高颜值、高扩展性、本地化的跨平台通用 AI Agent（Android / iOS / macOS）
</p>

<p align="center">
  <a href="README.md">English</a> •
  <a href="#-视觉与体验">视觉与体验</a> •
  <a href="#-极高扩展性">扩展生态</a> •
  <a href="#-核心特性">核心特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-贡献与参与">贡献与参与</a>
</p>

<p align="center">
  <a href="https://apps.apple.com/app/id6793855391">
    <img alt="Download on the App Store" height="48" src="public/badge-appstore.svg" />
  </a>
  &nbsp;
  <a href="https://github.com/Zhou-Shilin/Aether/releases">
    <img alt="Get the APK on GitHub" height="48" src="public/badge-android.svg" />
  </a>
</p>

<p align="center">
  国内用户交流反馈群 <a href="https://qun.qq.com/universal-share/share?ac=1&authKey=WW3dV15N2Fwwx8ccHc8Vr%2BKK%2FjahXsQxSyc1PFABg445%2BQstdp8wdKJXNJ%2F4ni8H&busi_data=eyJncm91cENvZGUiOiIxMDM5NzA3MDU0IiwidG9rZW4iOiJtTERRRmdRSFFSV1ZlWmltd0ovd3cyaDEvM0pKVnRUc01GZHN4eFlHdzYxZERMU3hyUGFER3VMem1BM0M2R0NpIiwidWluIjoiMjgzOTk5NzUyMiJ9&data=b-FXnCm72XohXWQFsusW_PQJ744NdI5giZMWJidb3-IfYVb5bEvpmpK2PMJnSiAjE8O-6aOi0ns1_TcY8JDoYA&svctype=4&tempid=h5_group_info">1039707054</a>
</p>

<p align="center">
  <table>
    <tr>
      <td><img src="public/welcome.jpg" width="280"></td>
      <td><img src="public/agentmode.jpg" width="280"></td>
      <td><img src="public/chat.jpg" width="280"></td>
      <td><img src="public/research.jpg" width="280"></td>
    </tr>
  </table>
</p>

---

## 🌪️ Aether 扶摇

> 鹏之徙于南冥也，水击三千里，抟扶摇而上者九万里，去以六月息者也。

**Aether 扶摇** 致力于为移动端及桌面设备（Android、iOS、macOS）提供现代化的本地 AI Agent 体验。基于 Pi 框架内核，在保持极简轻量 UI 的同时，提供了极其强大的扩展性与无缝的工具调用体验。

## 🧩 极高扩展性

Aether 原生兼容并支持加载标准 [Pi 扩展](https://github.com/earendil-works/pi)。为了让原本面向 TUI 的扩展在移动触摸屏上也能拥有优秀的交互体验，Aether 提供了专属的 **Extension API**，支持注入原生设置卡片、输入框上方实时卡片（Widget）、浮层对话查看器（Overlay）、提示词拦截钩子（Hooks）以及语义化工具标题（Tool Titles）。

| 扩展插件 | 功能简介 | 仓库地址 |
| :--- | :--- | :--- |
| **Pi Web Access*** | 支持 20+ 搜索引擎（OpenAI、Brave、Exa、Tavily、Perplexity、Gemini、SearXNG 等）的联网搜索、网页正文提取、GitHub 仓库克隆、PDF 提取及 YouTube / 本地视频理解，内置原生设置分类页与对话卡片。 | [AetherExtensions/pi-web-access](https://github.com/AetherExtensions/pi-web-access) |
| **Pi MCP Adapter*** | 模型上下文协议（MCP）适配网关，支持 Stdio、Streamable HTTP、SSE 与 Unix Socket 传输，具备懒加载与节约上下文的工具发现机制、交互式 OAuth 授权以及可视化服务器管理界面。 | [AetherExtensions/pi-mcp-adapter](https://github.com/AetherExtensions/pi-mcp-adapter) |
| **Pi Subagents*** | 类 Claude Code 的自主子 Agent 体系，支持并发后台执行、运行中实时 Steering 引导、输入框上方实时进度 Widget / FleetView 卡片、浮层对话查看器及 `@handle` 提示词定向派发。 | [AetherExtensions/pi-subagents](https://github.com/AetherExtensions/pi-subagents) |

*\* 表示由 Aether 官方团队适配的扩展。欢迎 [提交 PR](https://github.com/Zhou-Shilin/Aether/pulls) 将您的扩展加入列表。*

所有扩展均可通过 zip 压缩包直接在 **设置 → 扩展 → 导入扩展** 中一键安装与热重载。

扩展开发文档详见：<https://aether.baimoqilin.com/docs/extensions/overview.md>


## 📱 视觉与体验

Aether 的 UI 和交互大量参考了 ChatGPT、Codex CLI/App、Gemini、Poco Agent 等成熟的优秀应用。每一个动画、每一个交互细节都经过精心打磨，打破“开源项目简陋廉价”的刻板印象。

<p align="center">
  <table>
    <tr>
      <td><img src="public/input_bar.jpg" width="280"></td>
      <td><img src="public/tool_execution.jpg" width="280"></td>
      <td><img src="public/msg_options.jpg" width="280"></td>
    </tr>
  </table>
</p>


## ✨ 核心特性

- **超高颜值，丝滑交互**: 凝聚 ChatGPT 等优秀应用的设计精华，打造极简、现代、优雅的界面。
- **Pi Harness 内核**: 采用 Pi 框架，拥有最广泛的 Model Provider 兼容性，以及最轻量、最高效的 Agent 执行引擎。
- **极致的可扩展性**: 原生继承 Pi 的强大扩展体系，并提供独有的 Aether Script Extensions 与 Native Mods，支持深度定制移动端 UI、原生设置页、输入框组件与运行逻辑。
- **内置 Alpine 虚拟机**: 自动安装 Alpine Linux 运行环境，开箱即用，支持各种 Linux 工具与命令行操作。
- **系统文件管理器接入**（Android）: 初始化 Alpine 后，在系统“文件”或 SAF 文件选择器侧栏选择 **Aether（Alpine）**，即可浏览环境目录和 `/workspace`，新建、编辑、重命名、删除文件，或与手机存储互相复制。修改直接作用于 proot 使用的文件；`/dev`、`/proc`、`/sys` 等系统挂载不对外提供。
- **扩展主机控制**: 支持可选的 Shizuku 与 Termux 扩展，用于直接操纵和控制手机系统。（仅限 Android）


## 🚀 快速开始

见 <https://aether.baimoqilin.com/docs/quickstart>.


## 🤝 贡献与参与

本项目由一名 15 岁学生在课业之余断断续续开发而成 (⁠ʘ⁠ᴗ⁠ʘ⁠✿⁠)。目前项目仍在积极的迭代和打磨中。如果你喜欢这个项目，欢迎点一个 ⭐ Star，或者提交 PR 与 Issue 一起让 Aether 变得更好！

![Donation](public/donation.jpg)

---

## 特别鸣谢

- OpenAI Codex
- Google Gemini
- [Linux DO 社区](https://linux.do/)

---

## 📄 开源协议

本项目采用 **GPL License 3.0**。

---

<p align="center">
  Built with ❤️ by Shilin "BaimoQilin" Zhou.
</p>
