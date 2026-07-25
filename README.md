<p align="center">
  <img src="./public/agent-atlas-icon.png" width="144" height="144" alt="Agent Atlas 图标" />
</p>

<h1 align="center">Agent Atlas</h1>

<p align="center">
  <strong>A local-first workspace for AI agent projects.</strong><br />
  把分散的 Agent 项目、研究笔记、任务与开发历史整理成一张可导航的本地地图。
</p>

---

## 项目简介

Agent Atlas 是一个仅在本机运行的个人 AI Agent 项目工作台。它用清晰的项目卡片、独立详情页、跨项目执行队列和 Markdown 研究笔记，帮助开发者持续维护多个 Agent 项目的状态、下一步任务、阻塞项、技术资料与研究上下文。

项目坚持 **local-first**：

- 不需要账号、后端、数据库或环境变量；
- 业务数据保存在当前浏览器的版本化本地存储中；
- 不提供云同步、遥测或远程 Markdown 渲染；
- 读取文件和目录前必须由用户明确授权；
- 不扫描未选择的路径，也不持久化目录句柄；
- 支持完整 JSON 备份、合并恢复与替换恢复；
- 默认没有演示项目，不把开发夹具伪装成真实数据。

## 为什么叫 Agent Atlas

**Atlas** 既是地图册，也是结构化索引。这个名字对应项目的核心目标：为不断增加的 Agent 项目建立统一坐标，把项目状态、研究内容、执行任务、资源路径和变更历史连接起来，让开发者可以快速定位“现在在哪里”和“下一步去哪里”。

品牌图标将书页、字母 A 的负形和罗盘节点合并为一个标记：

- 书页代表项目档案与研究知识；
- A 代表 Agent 与 Atlas；
- 中心节点代表导航、连接和当前焦点；
- 钴蓝与暖纸色延续前端的编辑索引视觉。

最终图标位于 [`public/agent-atlas-icon.png`](public/agent-atlas-icon.png)，原始生成图保存在 [`public/agent-atlas-icon-source.png`](public/agent-atlas-icon-source.png)。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| 项目索引 | 使用卡片查看状态、完成度、里程碑、标签和最近更新 |
| 项目组织 | 支持搜索、状态筛选、标签、置顶和多集合管理 |
| 项目详情 | 汇总功能、路线图、任务、阻塞项、技术栈、资源和人工日志 |
| 开发工作台 | 跨项目聚合阻塞项、待办任务、近期来源和可能停滞项目 |
| 研究笔记 | 创建项目关联的 Markdown 文档，支持实时预览和稳定路由 |
| 草稿与版本 | 自动保存临时草稿，每篇正式笔记保留最近 10 个版本 |
| 模板复用 | 提供内置项目/笔记模板和自定义模板 CRUD |
| 自动时间线 | 记录状态、任务、阻塞、本地读取和笔记生命周期事件 |
| Codex 上下文 | 本地生成结构化 Markdown，可预览、复制或下载 |
| 本地读取 | 从明确选择的 JSON、Markdown、`package.json` 或目录生成草稿/更新 |
| 备份恢复 | 导出完整 JSON，支持合并、替换、冲突重映射和旧版迁移 |
| 使用指南 | 在 `#/guide` 中渲染随应用发布的完整 Markdown 操作指南 |

## 技术栈

- React 19
- Vite 6
- React Markdown + remark-gfm
- Phosphor Icons
- Noto Sans SC / Noto Serif SC / IBM Plex Mono
- Node.js Test Runner
- Vitest + React Testing Library + jsdom
- ESLint + Prettier

应用没有服务端运行时依赖。构建产物是静态前端，但项目约束为 **仅供本地使用，禁止发布或部署到公开网络**。

## 环境要求

- 推荐 Node.js **22.12+**
- 最低兼容 Node.js **20.18+**
- npm 10 或更高版本
- 支持 `localStorage`、Hash 路由和现代 JavaScript 的浏览器
- 如需选择项目目录，建议使用支持 File System Access API 的 Chromium 浏览器

确认环境：

```powershell
node --version
npm --version
```

## 快速开始

```powershell
npm install
npm run dev
```

按终端输出打开本地地址，通常是：

```text
http://localhost:5173/
```

项目不需要 `.env`、数据库或外部 API。已有依赖时可直接执行 `npm run dev`。

## 页面路由

Agent Atlas 使用 Hash 路由，刷新、前进和后退不需要服务器重写规则。

| 页面 | 路由 |
| --- | --- |
| 项目概览 | `#/` |
| 开发工作台 | `#/workbench` |
| 研究笔记 | `#/notes` |
| 新建研究笔记 | `#/notes/new` |
| 项目详情 | `#/project/<项目 ID>` |
| 项目开发记录 | `#/project/<项目 ID>/notes` |
| 阅读研究笔记 | `#/notes/<笔记 ID>` |
| 使用指南 | `#/guide` |

## 基本使用流程

### 1. 添加项目

从页头选择“添加项目”，然后：

1. 使用空白项目或内置模板；
2. 手工填写项目，或选择目录/状态文件生成草稿；
3. 检查“已检测、需确认、未检测到”的字段；
4. 编辑必填信息及可选的任务、阻塞、技术和资源字段；
5. 确认创建后进入项目详情页。

必填字段包括项目名称、一句话简介、当前状态、完成度和当前里程碑。

### 2. 维护项目

项目详情页支持：

- 编辑、复制和删除项目；
- 直接勾选或重新打开下一步任务；
- 查看未解决阻塞项；
- 查看功能、路线图和技术栈；
- 复制本地目录、文档和产物路径；
- 打开 HTTP/HTTPS 资源；
- 读取并预览本地状态；
- 创建关联研究笔记；
- 生成 Codex 项目上下文；
- 筛选自动变更时间线。

删除项目需要二次确认，并会清理关联笔记、草稿、正式版本历史和自动事件。重要内容应先导出备份。

### 3. 聚焦执行

开发工作台从现有数据实时派生执行队列，默认顺序为：

1. 未解决阻塞；
2. 活跃项目的未完成任务；
3. 其他未完成任务；
4. 可能停滞的项目。

“可能停滞”只表示项目未完成且至少 14 天没有更新，不会修改项目事实状态。

### 4. 沉淀研究

研究笔记是项目关联的 Markdown 文档，与项目表单中的简短人工开发记录分开保存。

- 桌面端并排编辑和预览；
- 移动端可切换编辑/预览；
- 支持 GFM 表格、任务列表、引用和代码块；
- 原始 HTML、脚本、危险 URL 与远程图片不会执行；
- 未保存内容进入本地草稿；
- 每篇正式笔记保留最近 10 个历史版本。

### 5. 备份数据

在“设置 → 备份与恢复”中：

- **导出**：下载带 schema 版本的完整 JSON；
- **合并导入**：保留当前数据并导入备份，冲突 ID 自动重映射；
- **替换导入**：使用备份完整替换当前业务数据；
- **清空全部本地内容**：二次确认后删除本地业务数据。

完整备份包含项目、研究笔记、正式版本历史、自动时间线、自定义模板和项目集合。临时笔记草稿与显示偏好不进入正式备份。

## 项目字段格式

部分多行字段使用简单文本格式：

```text
# 功能列表
功能名称 | 状态

# 路线图
阶段 | 说明 | done/current/next

# 任务或阻塞项
- [ ] 尚未完成
- [x] 已经完成
```

每个项目最多包含 12 个标签，每个标签最多 24 个字符。标签会自动去除首尾空格、空值和不区分大小写的重复项。

## 本地文件读取边界

添加项目和详情页的“读取本地状态”都遵循相同的显式授权边界。

支持来源：

- JSON 状态文件；
- Markdown 文件；
- `package.json`；
- 用户明确选择的项目目录。

目录模式只读取白名单内的 README、TODO、状态 JSON、`package.json` 和 Git 分支/提交元数据。单文件读取上限为 1 MB，单次总读取上限为 4 MB。

读取结果会先生成预览或可编辑草稿，不会直接修改数据。Agent Atlas 不保存文件内容、目录句柄和权限，也不会根据文本路径自动访问文件系统。

## 本地存储说明

浏览器的 `localStorage` 按“浏览器 + 用户配置 + 站点来源”隔离。以下情况可能看到另一份空数据：

- 更换浏览器或浏览器配置；
- 更换端口或主机名；
- 使用隐私模式；
- 清除站点数据。

浏览器不会自动创建磁盘备份。项目路径、日志、仓库地址和研究内容可能包含私人信息，导出的 JSON 与 Markdown 也应作为本地私密文件保管。

## 项目结构

```text
agent-project-showcase/
├─ public/
│  ├─ agent-atlas-icon.png
│  └─ agent-atlas-icon-source.png
├─ src/
│  ├─ components/        # 可复用 UI、弹窗和面板
│  ├─ content/           # 随应用发布的 Markdown 内容
│  ├─ data/              # 数据模型、持久化、备份和派生逻辑
│  ├─ hooks/             # 路由与交互 hooks
│  ├─ pages/             # 概览、详情、工作台、笔记和指南页面
│  ├─ utils/             # 剪贴板与图标等工具
│  ├─ App.jsx            # 状态编排与页面组合
│  ├─ routing.js         # Hash 路由解析与页面标题
│  └─ styles.css         # 设计系统与响应式样式
├─ AGENTS.md             # 持久设计和开发约束
├─ PROJECT_TODO.md       # 任务、进度和验收记录
└─ README.md
```

## 开发命令

```powershell
npm run dev
npm run lint
npm run format
npm run format:check
npm run test:unit
npm run test:components
npm test
npm run build
npm run check
```

`npm run check` 是提交前的完整质量门禁，会依次执行 ESLint、Prettier 检查、Node 单元测试、Vitest 组件测试和 Vite 生产构建。

当前质量基线：

- 89 项 Node 单元测试；
- 41 项组件测试；
- Vite 生产构建通过。

## 文档维护

- 面向用户的完整操作说明位于 [`src/content/USER_GUIDE.md`](src/content/USER_GUIDE.md)，并渲染在 `#/guide`。
- 用户可见功能变化时，应同步更新使用指南中的入口、步骤、数据影响和安全边界。
- 开发任务和验收状态以 [`PROJECT_TODO.md`](PROJECT_TODO.md) 为准。
- 持久设计决策和本地优先约束记录在 [`AGENTS.md`](AGENTS.md)。

## 设计语言

Agent Atlas 延续轻量编辑索引风格：

- 暖纸色背景；
- 钴蓝强调色；
- 中文衬线展示字体；
- 等宽元数据；
- 克制边框和信息层级；
- 桌面双栏/卡片布局与 390px 移动端适配。

## 安全与发布约束

- 不上传项目或研究数据；
- 不添加遥测、远程同步或云数据库；
- 不执行 Markdown 原始 HTML；
- 不自动扫描本地文件；
- 不把指南或图标写入业务备份；
- **禁止发布或部署本项目到公开网络。**

---

<p align="center">
  <strong>Agent Atlas</strong><br />
  Navigate your agents. Keep the knowledge local.
</p>
