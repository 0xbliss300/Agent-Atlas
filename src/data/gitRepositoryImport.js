import { analyzeLocalStatusText, MAX_LOCAL_FILE_BYTES, mergeTechnology } from "./localStatus.js";
import { createProjectImportDraft } from "./projectImport.js";

export const GITHUB_API_HOST = "api.github.com";
export const GITHUB_WEB_HOST = "github.com";
export const MAX_README_BYTES = MAX_LOCAL_FILE_BYTES;
export const MAX_PACKAGE_JSON_BYTES = MAX_LOCAL_FILE_BYTES;

const ACCEPTED_HOSTS = new Set([GITHUB_WEB_HOST, "www.github.com"]);
const ACCEPTED_PROTOCOLS = new Set(["https:", "http:", "git:", "ssh:"]);

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 将 Git 仓库 URL 解析为 { host, owner, repo, url }。
 * 支持 HTTPS、git+https、git://、SSH 简写与 ssh:// 形式，仅接受 github.com。
 */
export function parseGitRepositoryUrl(rawUrl) {
  const url = cleanText(rawUrl);
  if (!url) throw new Error("请输入 Git 仓库 URL。");

  let host;
  let owner;
  let repo;

  const sshShorthand = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/);
  if (sshShorthand) {
    [, host, owner, repo] = sshShorthand;
  } else {
    const normalized = url.replace(/^git\+/, "");
    let parsed;
    try {
      parsed = new URL(normalized);
    } catch {
      throw new Error("Git 仓库 URL 格式无效，请使用 HTTPS 或 SSH 地址。");
    }
    if (!ACCEPTED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error("仅支持 HTTPS、SSH 或 git 协议的仓库地址。");
    }
    host = parsed.hostname;
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length < 2) {
      throw new Error("URL 中缺少 owner/repo 路径。");
    }
    try {
      owner = decodeURIComponent(parts[0]);
    } catch {
      owner = parts[0];
    }
    repo = parts[1].replace(/\.git$/, "");
  }

  host = host.toLowerCase();
  if (!ACCEPTED_HOSTS.has(host)) {
    throw new Error(`目前仅支持 github.com 的仓库，收到：${host}。`);
  }
  if (!owner || !repo) {
    throw new Error("无法从 URL 解析 owner 或 repo。");
  }

  return {
    host: GITHUB_WEB_HOST,
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
  };
}

/**
 * 纯函数：根据已拉取的仓库元数据生成与 localStatus.js 兼容的分析结果。
 * 字段优先级：package.json > README > 仓库元数据（与本地目录导入行为一致）。
 */
export function analyzeGitRepositoryMetadata({
  url,
  owner,
  repo,
  repository,
  readme,
  packageJson,
  latestCommit,
  fetchedAt = new Date(),
}) {
  const sourceName = `${owner}/${repo}`;
  const filesRead = [];
  const notes = [];
  const project = { repositoryUrl: url };
  const fetchedTimestamp = Number.isFinite(Date.parse(fetchedAt))
    ? Date.parse(fetchedAt)
    : Date.now();

  if (repository) {
    filesRead.push("repository metadata");
    if (cleanText(repository.description)) {
      project.short = cleanText(repository.description);
      project.description = cleanText(repository.description);
    }
    if (cleanText(repository.language)) {
      project.technology = {
        languages: [cleanText(repository.language)],
      };
    }
    if (cleanText(repository.pushed_at)) {
      project.updatedAt = cleanText(repository.pushed_at);
    }
    if (repository.license?.spdx_id && repository.license.spdx_id !== "NOASSERTION") {
      notes.push(`许可证：${repository.license.spdx_id}`);
    }
    notes.push(`读取仓库元数据：${sourceName}`);
  }

  if (readme?.text) {
    const name = readme.name || "README.md";
    filesRead.push(name);
    const result = analyzeLocalStatusText({
      name,
      text: readme.text,
      lastModified: fetchedTimestamp,
    });
    Object.assign(project, result.project);
    if (result.project.technology) {
      project.technology = mergeTechnology(project.technology, result.project.technology);
    }
    notes.push(...result.notes);
  }

  if (packageJson?.text) {
    filesRead.push("package.json");
    const result = analyzeLocalStatusText({
      name: "package.json",
      text: packageJson.text,
      lastModified: fetchedTimestamp,
    });
    Object.assign(project, result.project);
    if (result.project.technology) {
      project.technology = mergeTechnology(project.technology, result.project.technology);
    }
    notes.push(...result.notes);
  }

  const branch = cleanText(repository?.default_branch) || "main";
  const git = latestCommit
    ? {
        branch,
        commit: cleanText(latestCommit.sha).slice(0, 12),
        updatedAt: cleanText(latestCommit.commit?.author?.date) || undefined,
        filesRead: ["commits?per_page=1"],
      }
    : null;

  if (
    git?.updatedAt &&
    (!project.updatedAt || Date.parse(git.updatedAt) > Date.parse(project.updatedAt))
  ) {
    project.updatedAt = git.updatedAt;
  }

  return {
    sourceType: "git-repository",
    sourceName,
    filesRead,
    git,
    project,
    notes,
  };
}

async function fetchJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, options);
  const status = response.status;
  if (status === 404) {
    const error = new Error("NOT_FOUND");
    error.status = 404;
    throw error;
  }
  if (status === 403) {
    const error = new Error("FORBIDDEN");
    error.status = 403;
    throw error;
  }
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP_${status}`);
    error.status = status;
    throw error;
  }
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error("INVALID_JSON");
    error.status = status;
    throw error;
  }
}

async function fetchText(fetchImpl, url, options = {}, maxBytes) {
  const response = await fetchImpl(url, options);
  const status = response.status;
  if (status === 404) {
    const error = new Error("NOT_FOUND");
    error.status = 404;
    throw error;
  }
  if (status === 403) {
    const error = new Error("FORBIDDEN");
    error.status = 403;
    throw error;
  }
  if (status < 200 || status >= 300) {
    const error = new Error(`HTTP_${status}`);
    error.status = status;
    throw error;
  }
  const text = await response.text();
  if (maxBytes && text.length > maxBytes) {
    return text.slice(0, maxBytes);
  }
  return text;
}

function withGitAccept(headers = {}) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...headers,
  };
}

/**
 * 通过 GitHub REST API 拉取仓库元数据（只读、不保存凭证、不持久化远程句柄）。
 * fetchImpl 可注入以便测试；默认使用全局 fetch。
 */
export async function fetchGitRepositoryMetadata(parsed, { fetchImpl = globalThis.fetch } = {}) {
  const { owner, repo } = parsed;
  const base = `https://${GITHUB_API_HOST}/repos/${owner}/${repo}`;
  const defaultHeaders = withGitAccept();

  let repository;
  try {
    repository = await fetchJson(fetchImpl, base, { headers: defaultHeaders });
  } catch (error) {
    if (error.status === 404) {
      throw new Error(`未找到仓库 ${owner}/${repo}，或仓库为私有。`);
    }
    if (error.status === 403) {
      throw new Error("GitHub API 速率限制或无访问权限，请稍后再试。");
    }
    throw new Error(`无法读取仓库元数据：${error.message || "网络错误，请检查 URL 或网络连接。"}`);
  }

  let readme = null;
  try {
    const text = await fetchText(
      fetchImpl,
      `${base}/readme`,
      { headers: withGitAccept({ Accept: "application/vnd.github.raw" }) },
      MAX_README_BYTES,
    );
    if (text) {
      readme = { name: "README.md", text };
    }
  } catch {
    // README 可选：404 或其他错误均跳过
  }

  let packageJson = null;
  try {
    const text = await fetchText(
      fetchImpl,
      `${base}/contents/package.json`,
      { headers: withGitAccept({ Accept: "application/vnd.github.raw" }) },
      MAX_PACKAGE_JSON_BYTES,
    );
    if (text) {
      packageJson = { name: "package.json", text };
    }
  } catch {
    // package.json 可选
  }

  let latestCommit = null;
  try {
    const commits = await fetchJson(fetchImpl, `${base}/commits?per_page=1`, {
      headers: defaultHeaders,
    });
    if (Array.isArray(commits) && commits.length > 0) {
      latestCommit = commits[0];
    }
  } catch {
    // 提交历史可选（空仓库无提交）
  }

  return { repository, readme, packageJson, latestCommit };
}

/**
 * 高层入口：解析 URL → 拉取元数据 → 生成可编辑草稿。
 */
export async function importGitRepository(
  url,
  existingProjects = [],
  { fetchImpl, now = new Date() } = {},
) {
  const parsed = parseGitRepositoryUrl(url);
  const metadata = await fetchGitRepositoryMetadata(parsed, { fetchImpl });
  const result = analyzeGitRepositoryMetadata({ ...parsed, ...metadata, fetchedAt: now });
  return createProjectImportDraft(result, existingProjects, now);
}
