const VALID_STATUSES = new Set(["planning", "active", "paused", "done"]);
export const MAX_LOCAL_FILE_BYTES = 1024 * 1024;
export const MAX_LOCAL_TOTAL_BYTES = 4 * 1024 * 1024;
export const MAX_LOCAL_FILES = 12;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function simpleId(prefix, value) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `${prefix}-${hash.toString(36)}`;
}

function normalizeChecklist(items, prefix) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const title = cleanText(typeof item === "string" ? item : (item?.title ?? item?.text));
      return {
        id: cleanText(item?.id) || simpleId(prefix, title),
        title,
        done: Boolean(item?.done ?? item?.resolved),
      };
    })
    .filter((item) => item.title);
}

function normalizeTextList(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  return cleanText(value)
    .split(/[\r\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isoFromTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return new Date(timestamp).toISOString();
}

function analyzeJson(text, fileName, lastModified) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${fileName} 不是有效的 JSON 文件。`);
  }
  const source = payload.project ?? payload;
  const project = {};
  if (cleanText(source.name)) project.name = cleanText(source.name);
  if (VALID_STATUSES.has(source.status)) project.status = source.status;
  if (Number.isFinite(Number(source.progress))) project.progress = Number(source.progress);
  if (cleanText(source.milestone)) project.milestone = cleanText(source.milestone);
  if (cleanText(source.short)) project.short = cleanText(source.short);
  if (cleanText(source.description)) project.description = cleanText(source.description);

  const blockers = normalizeChecklist(source.blockers, "local-blocker");
  const nextTasks = normalizeChecklist(source.nextTasks ?? source.tasks, "local-task");
  if (blockers.length) project.blockers = blockers;
  if (nextTasks.length) project.nextTasks = nextTasks;

  const technology = source.technology ?? {};
  const normalizedTechnology = {
    languages: normalizeTextList(technology.languages),
    frameworks: normalizeTextList(technology.frameworks),
    models: normalizeTextList(technology.models),
    dataSources: normalizeTextList(technology.dataSources),
    runCommand: cleanText(technology.runCommand ?? source.runCommand),
  };
  if (
    normalizedTechnology.languages.length ||
    normalizedTechnology.frameworks.length ||
    normalizedTechnology.models.length ||
    normalizedTechnology.dataSources.length ||
    normalizedTechnology.runCommand
  ) {
    project.technology = normalizedTechnology;
  }

  const updatedAt = cleanText(source.updatedAt);
  project.updatedAt = Number.isFinite(Date.parse(updatedAt))
    ? updatedAt
    : isoFromTimestamp(lastModified);
  return { project, notes: [`读取结构化状态：${fileName}`] };
}

function parseMarkdownSection(lines, pattern) {
  const start = lines.findIndex((line) => /^#{1,6}\s+/.test(line) && pattern.test(line));
  if (start < 0) return [];
  const section = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index])) break;
    const item = lines[index].match(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?(.+)$/);
    if (item?.[1]) section.push(item[1].trim());
  }
  return section;
}

function analyzeMarkdown(text, fileName, lastModified) {
  const lines = text.split(/\r?\n/);
  const checkboxes = lines
    .map((line) => line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      id: simpleId("local-task", match[2].trim()),
      title: match[2].trim(),
      done: match[1].toLowerCase() === "x",
    }));
  const project = { updatedAt: isoFromTimestamp(lastModified) };
  if (/^readme(?:\.|$)/i.test(fileName)) {
    const title = lines
      .find((line) => /^#\s+\S/.test(line))
      ?.replace(/^#\s+/, "")
      .trim();
    const firstParagraph = lines
      .map((line) => line.trim())
      .find(
        (line) =>
          line &&
          !line.startsWith("#") &&
          !line.startsWith("[") &&
          !line.startsWith("!") &&
          !/^[-*]\s/.test(line) &&
          !/^```/.test(line),
      );
    if (title) project.name = title;
    if (firstParagraph) {
      project.short = firstParagraph;
      project.description = firstParagraph;
    }
  }
  if (checkboxes.length) {
    const done = checkboxes.filter((item) => item.done).length;
    project.progress = Math.round((done / checkboxes.length) * 100);
    project.nextTasks = checkboxes.slice(0, 30);
  }
  const blockers = parseMarkdownSection(lines, /阻塞|blocker/i).map((title) => ({
    id: simpleId("local-blocker", title),
    title,
    done: false,
  }));
  if (blockers.length) project.blockers = blockers;

  const milestoneLine = lines.find((line) => /^(?:当前里程碑|milestone)\s*[:：]/i.test(line));
  if (milestoneLine) {
    project.milestone = milestoneLine.replace(/^[^:：]+[:：]\s*/, "").trim();
  }
  return {
    project,
    notes: [
      `读取 Markdown：${fileName}`,
      checkboxes.length ? `识别 ${checkboxes.length} 个勾选任务` : "未发现勾选任务",
    ],
  };
}

function analyzePackageJson(text, fileName, lastModified) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${fileName} 不是有效的 package.json。`);
  }
  const dependencies = {
    ...(payload.dependencies ?? {}),
    ...(payload.devDependencies ?? {}),
  };
  const names = Object.keys(dependencies);
  const frameworkPatterns = [
    /^react$/,
    /^vue$/,
    /^svelte$/,
    /^next$/,
    /^vite$/,
    /^astro$/,
    /^express$/,
    /^fastify$/,
    /^vitest$/,
    /^playwright$/,
  ];
  const modelPatterns = [/^openai$/, /anthropic/, /ollama/, /langchain/, /llamaindex/];
  const dataPatterns = [/sqlite/, /prisma/, /postgres/, /mongodb/, /redis/, /supabase/];
  const frameworks = names.filter((name) =>
    frameworkPatterns.some((pattern) => pattern.test(name)),
  );
  const models = names.filter((name) => modelPatterns.some((pattern) => pattern.test(name)));
  const dataSources = names.filter((name) => dataPatterns.some((pattern) => pattern.test(name)));
  const project = {
    updatedAt: isoFromTimestamp(lastModified),
    technology: {
      languages: names.some((name) => name === "typescript") ? ["TypeScript"] : ["JavaScript"],
      frameworks,
      models,
      dataSources,
      runCommand: payload.scripts?.dev ? "npm run dev" : payload.scripts?.start ? "npm start" : "",
    },
  };
  if (cleanText(payload.name)) project.name = cleanText(payload.name);
  if (cleanText(payload.description)) {
    project.short = cleanText(payload.description);
    project.description = cleanText(payload.description);
  }
  return {
    project,
    notes: [`读取依赖与脚本：${fileName}`],
  };
}

export function analyzeLocalStatusText({
  name = "本地状态文件",
  text = "",
  lastModified = Date.now(),
}) {
  const lowerName = name.toLowerCase();
  let result;
  if (lowerName === "package.json") {
    result = analyzePackageJson(text, name, lastModified);
  } else if (lowerName.endsWith(".json")) {
    result = analyzeJson(text, name, lastModified);
  } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
    result = analyzeMarkdown(text, name, lastModified);
  } else {
    throw new Error("仅支持 JSON、Markdown 和 package.json 文件。");
  }
  return {
    sourceType: "file",
    sourceName: name,
    filesRead: [name],
    git: null,
    ...result,
  };
}

function assertFileSize(file) {
  const size = Number(file?.size);
  if (Number.isFinite(size) && size > MAX_LOCAL_FILE_BYTES) {
    throw new Error(
      `${file.name || "所选文件"} 超过单文件 ${MAX_LOCAL_FILE_BYTES / 1024 / 1024} MB 的读取上限。`,
    );
  }
}

export async function readLocalStatusFile(file) {
  if (!file?.text) throw new Error("未获得可读取的本地文件。");
  assertFileSize(file);
  return analyzeLocalStatusText({
    name: file.name,
    text: await file.text(),
    lastModified: file.lastModified,
  });
}

async function readFileHandle(handle) {
  const file = await handle.getFile();
  assertFileSize(file);
  return {
    name: file.name,
    text: await file.text(),
    lastModified: file.lastModified,
    size: Number.isFinite(Number(file.size)) ? Number(file.size) : 0,
  };
}

async function tryReadFile(directory, name) {
  try {
    return await readFileHandle(await directory.getFileHandle(name));
  } catch (error) {
    if (error?.name === "NotFoundError") return null;
    throw error;
  }
}

async function tryReadNestedFile(directory, path) {
  try {
    const parts = path.split("/");
    let current = directory;
    for (const part of parts.slice(0, -1)) {
      current = await current.getDirectoryHandle(part);
    }
    return await readFileHandle(await current.getFileHandle(parts.at(-1)));
  } catch (error) {
    if (error?.name === "NotFoundError") return null;
    throw error;
  }
}

export function mergeTechnology(current = {}, next = {}) {
  const mergeList = (left, right) => {
    const merged = new Map();
    [...(left ?? []), ...(right ?? [])].forEach((item) => {
      const value = cleanText(item);
      if (value) merged.set(value.toLocaleLowerCase(), value);
    });
    return [...merged.values()];
  };
  const languages = mergeList(current.languages, next.languages);
  if (next.languages?.some((language) => cleanText(language).toLowerCase() === "typescript")) {
    const javascriptIndex = languages.findIndex(
      (language) => language.toLowerCase() === "javascript",
    );
    if (javascriptIndex >= 0) languages.splice(javascriptIndex, 1);
  }
  return {
    languages,
    frameworks: mergeList(current.frameworks, next.frameworks),
    models: mergeList(current.models, next.models),
    dataSources: mergeList(current.dataSources, next.dataSources),
    runCommand: next.runCommand || current.runCommand || "",
  };
}

async function readGitInfo(directory) {
  const head = await tryReadNestedFile(directory, ".git/HEAD");
  if (!head) return null;
  const headValue = head.text.trim();
  const ref = headValue.startsWith("ref: ") ? headValue.slice(5) : "";
  const refFile = ref ? await tryReadNestedFile(directory, `.git/${ref}`) : null;
  const logs = await tryReadNestedFile(directory, ".git/logs/HEAD");
  const lastLog = logs?.text.trim().split(/\r?\n/).at(-1) ?? "";
  const timestampMatch = lastLog.match(/>\s+(\d{9,})\s+[+-]\d{4}\t/);
  return {
    branch: ref.replace("refs/heads/", ""),
    commit: (refFile?.text.trim() || headValue).slice(0, 12),
    updatedAt: timestampMatch ? isoFromTimestamp(Number(timestampMatch[1]) * 1000) : undefined,
    filesRead: [head, refFile, logs].filter(Boolean).map((item) => `.git/${item.name}`),
    size: [head, refFile, logs].filter(Boolean).reduce((sum, item) => sum + (item.size ?? 0), 0),
  };
}

export async function analyzeLocalDirectory(directory) {
  if (!directory?.getFileHandle) throw new Error("未获得可读取的本地目录。");
  const knownNames = [
    "README.md",
    "PROJECT_TODO.md",
    "project-status.json",
    "status.json",
    "package.json",
  ];
  const files = (await Promise.all(knownNames.map((name) => tryReadFile(directory, name)))).filter(
    Boolean,
  );
  const git = await readGitInfo(directory);
  if (!files.length && !git) {
    throw new Error("目录中没有找到 README、TODO、状态 JSON、package.json 或 Git 元数据。");
  }
  const filesRead = [...files.map((file) => file.name), ...(git?.filesRead ?? [])];
  if (filesRead.length > MAX_LOCAL_FILES) {
    throw new Error(`本次读取来源超过 ${MAX_LOCAL_FILES} 个文件的上限。`);
  }
  const totalBytes = files.reduce((sum, file) => sum + (file.size ?? 0), 0) + (git?.size ?? 0);
  if (totalBytes > MAX_LOCAL_TOTAL_BYTES) {
    throw new Error(`本次读取内容超过 ${MAX_LOCAL_TOTAL_BYTES / 1024 / 1024} MB 的总量上限。`);
  }

  const project = {};
  const notes = [];
  const filePriority = new Map([
    ["README.md", 0],
    ["PROJECT_TODO.md", 1],
    ["package.json", 2],
    ["status.json", 3],
    ["project-status.json", 4],
  ]);
  const orderedFiles = [...files].sort(
    (left, right) => filePriority.get(left.name) - filePriority.get(right.name),
  );
  for (const file of orderedFiles) {
    const result = analyzeLocalStatusText(file);
    const currentTechnology = project.technology;
    Object.assign(project, result.project);
    project.technology = mergeTechnology(currentTechnology, result.project.technology);
    notes.push(...result.notes);
  }
  if (
    git?.updatedAt &&
    (!project.updatedAt || Date.parse(git.updatedAt) > Date.parse(project.updatedAt))
  ) {
    project.updatedAt = git.updatedAt;
  }
  return {
    sourceType: "directory",
    sourceName: directory.name,
    filesRead,
    git,
    project,
    notes,
    bytesRead: totalBytes,
  };
}
