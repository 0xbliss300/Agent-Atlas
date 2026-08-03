export const DEFAULT_CONTEXT_NOTE_LIMIT = 3;
export const CONTEXT_LENGTH_WARNING = 50000;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeMarkdownText(value) {
  return escapeHtml(text(value)).replace(/([\\`*_[\]{}()#+.!|>-])/g, "\\$1");
}

function safeMarkdownBody(value) {
  return escapeHtml(text(value)).replace(
    /\b(javascript|vbscript|data)\s*:/gi,
    (_, scheme) => `${scheme}-blocked:`,
  );
}

function inlineCode(value) {
  const cleaned = text(value);
  if (!cleaned) return "未配置";
  const longestRun = Math.max(0, ...[...cleaned.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padding = cleaned.startsWith("`") || cleaned.endsWith("`") ? " " : "";
  return `${fence}${padding}${escapeHtml(cleaned)}${padding}${fence}`;
}

function valueOrMissing(value) {
  return text(value) ? escapeMarkdownText(value) : "未配置";
}

function listOrMissing(values = []) {
  const cleaned = values.map(text).filter(Boolean);
  return cleaned.length ? cleaned.map(inlineCode).join("、") : "未配置";
}

function checklist(items = []) {
  return items.length
    ? items.map((item) => `- [ ] ${escapeMarkdownText(item.title)}`).join("\n")
    : "未配置（当前没有相关条目）。";
}

function resourceLine(label, value, forceCode = false) {
  const cleaned = text(value);
  if (!cleaned) return `- ${label}：未配置`;
  const isUrl = /^https?:\/\//i.test(cleaned);
  return `- ${label}：${forceCode || !isUrl ? inlineCode(cleaned) : escapeHtml(cleaned)}`;
}

function formatGeneratedAt(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
  return `${year}-${month}-${day} ${hour}:${minute} ${offset}`;
}

export function selectDefaultContextNoteIds(notes = [], limit = DEFAULT_CONTEXT_NOTE_LIMIT) {
  return [...notes]
    .sort(
      (left, right) =>
        (right.updatedTimestamp ?? Date.parse(right.updatedAt) ?? 0) -
          (left.updatedTimestamp ?? Date.parse(left.updatedAt) ?? 0) ||
        String(left.id).localeCompare(String(right.id)),
    )
    .slice(0, Math.max(0, limit))
    .map((note) => note.id);
}

export function sanitizeContextFilename(projectName) {
  const safeBase = text(projectName)
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*]/g, "-")
    .replace(/\p{Cc}/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/[.\s-]+$/g, "")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+/g, "")
    .slice(0, 80)
    .trim();
  return `${safeBase || "project"}-CODEX_CONTEXT.md`;
}

export function generateCodexContext(project, selectedNotes = [], generatedAt = new Date()) {
  const unresolvedBlockers = (project?.blockers ?? []).filter((item) => !item.done);
  const unfinishedTasks = (project?.nextTasks ?? []).filter((item) => !item.done);
  const recentLogs = (project?.log ?? []).slice(0, 10);
  const omittedLogs = Math.max(0, (project?.log?.length ?? 0) - recentLogs.length);
  const notes = [...selectedNotes].sort(
    (left, right) =>
      (right.updatedTimestamp ?? Date.parse(right.updatedAt) ?? 0) -
        (left.updatedTimestamp ?? Date.parse(left.updatedAt) ?? 0) ||
      String(left.id).localeCompare(String(right.id)),
  );
  const noteIndex = notes.length
    ? notes
        .map(
          (note, index) =>
            `${index + 1}. ${escapeMarkdownText(note.title)}（更新于 ${valueOrMissing(note.updatedAt || note.updated)}）`,
        )
        .join("\n")
    : "未包含研究笔记。";
  const noteBodies = notes.length
    ? notes
        .map(
          (note, index) =>
            `### ${index + 1}. ${escapeMarkdownText(note.title)}\n\n- 更新时间：${valueOrMissing(note.updatedAt || note.updated)}\n\n${safeMarkdownBody(note.body) || "未配置"}`,
        )
        .join("\n\n")
    : "未选择研究笔记；可重新生成并勾选需要交接的笔记。";

  return [
    `# Codex 项目开发上下文：${escapeMarkdownText(project?.name) || "未命名项目"}`,
    "",
    `> 生成时间：${formatGeneratedAt(generatedAt)}`,
    "> 此 Markdown 由浏览器本地即时生成，可能包含本地路径、仓库地址和私人研究内容。请在复制或下载前检查。",
    "",
    "## 1. 项目目标",
    "",
    `- 项目名称：${valueOrMissing(project?.name)}`,
    `- 一句话简介：${valueOrMissing(project?.short)}`,
    `- 目标与背景：${valueOrMissing(project?.description)}`,
    "",
    "## 2. 当前状态",
    "",
    `- 状态：${valueOrMissing(project?.statusLabel)}`,
    `- 完成度：${Number.isFinite(project?.progress) ? `${project.progress}%` : "未配置"}`,
    `- 当前里程碑：${valueOrMissing(project?.milestone)}`,
    `- 最近更新：${valueOrMissing(project?.updatedAt || project?.updated)}`,
    "",
    "## 3. 未解决阻塞项",
    "",
    checklist(unresolvedBlockers),
    "",
    "## 4. 未完成任务",
    "",
    checklist(unfinishedTasks),
    "",
    "## 5. 技术栈",
    "",
    `- 语言：${listOrMissing(project?.technology?.languages)}`,
    `- 框架：${listOrMissing(project?.technology?.frameworks)}`,
    `- 模型：${listOrMissing(project?.technology?.models)}`,
    `- 数据源：${listOrMissing(project?.technology?.dataSources)}`,
    "",
    "## 6. Agent 技术档案",
    "",
    `- 模型版本：${valueOrMissing(project?.agentProfile?.modelVersion)}`,
    `- Prompt 版本：${valueOrMissing(project?.agentProfile?.promptVersion)}`,
    `- 数据集：${listOrMissing(project?.agentProfile?.datasets)}`,
    `- 运行环境：${valueOrMissing(project?.agentProfile?.runtime)}`,
    `- Token 成本：${valueOrMissing(project?.agentProfile?.tokenCost)}`,
    `- 推理参数：${valueOrMissing(project?.agentProfile?.inferenceParams)}`,
    "",
    "## 7. 运行命令",
    "",
    project?.technology?.runCommand
      ? `- 本地启动：${inlineCode(project.technology.runCommand)}`
      : "- 本地启动：未配置",
    "",
    "## 8. 本地资源",
    "",
    resourceLine("本地目录", project?.localPath, true),
    resourceLine("代码仓库", project?.repositoryUrl),
    resourceLine("项目文档", project?.documentationPath),
    resourceLine("本地演示", project?.demoUrl),
    resourceLine("本地产物", project?.previewPath, true),
    "",
    "## 9. 最近开发记录",
    "",
    recentLogs.length
      ? recentLogs.map((item) => `- ${escapeMarkdownText(item)}`).join("\n")
      : "未配置（尚无开发记录）。",
    ...(omittedLogs ? [`- 另有 ${omittedLogs} 条较早记录未包含。`] : []),
    "",
    "## 10. 研究笔记索引",
    "",
    noteIndex,
    "",
    "## 11. 已选研究笔记",
    "",
    noteBodies,
    "",
  ].join("\n");
}

export function createCodexContext(project, selectedNotes = [], generatedAt = new Date()) {
  const markdown = generateCodexContext(project, selectedNotes, generatedAt);
  return {
    markdown,
    characterCount: markdown.length,
    noteCount: selectedNotes.length,
    generatedAt,
    filename: sanitizeContextFilename(project?.name),
    isLong: markdown.length > CONTEXT_LENGTH_WARNING,
  };
}
