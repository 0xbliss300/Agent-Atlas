/**
 * 轻量 WebDAV 客户端：仅支持上传（PUT）、下载（GET）、删除（DELETE）与存在性检查（HEAD）。
 *
 * 凭证（用户名/密码）仅在调用时传入，不持久化到 data/ 或 localStorage。
 * 所有请求由调用方注入 fetchImpl，便于测试与自定义传输。
 */

function normalizeBasePath(path) {
  if (!path) return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function buildUrl(config, path) {
  const base = config.baseUrl.replace(/\/+$/, "");
  const normalizedPath = normalizeBasePath(config.basePath);
  const filePath = normalizeBasePath(path);
  return `${base}${normalizedPath}${filePath}`;
}

function buildHeaders(config, extra = {}) {
  const headers = { ...extra };
  if (config.username && config.password) {
    const credentials = globalThis.btoa(`${config.username}:${config.password}`);
    headers.Authorization = `Basic ${credentials}`;
  }
  return headers;
}

function ensureConfig(config) {
  if (!config?.baseUrl) {
    throw new Error("WebDAV baseUrl 未配置。");
  }
  try {
    const url = new URL(config.baseUrl);
    if (!/^https?:$/.test(url.protocol)) {
      throw new Error("WebDAV baseUrl 必须使用 http 或 https 协议。");
    }
  } catch {
    throw new Error("WebDAV baseUrl 格式无效。");
  }
}

async function parseResponseError(response) {
  const status = response.status;
  if (status === 401) return "WebDAV 认证失败：用户名或密码错误。";
  if (status === 403) return "WebDAV 访问被拒绝：无权限。";
  if (status === 404) return "WebDAV 资源不存在。";
  if (status === 409) return "WebDAV 父目录不存在。";
  if (status >= 500) return `WebDAV 服务器错误：${status}。`;
  return `WebDAV 请求失败：${status}。`;
}

export async function uploadFile(config, path, content, { fetchImpl = globalThis.fetch } = {}) {
  ensureConfig(config);
  const url = buildUrl(config, path);
  const headers = buildHeaders(config, {
    "Content-Type": "application/json; charset=utf-8",
  });
  const response = await fetchImpl(url, {
    method: "PUT",
    headers,
    body: typeof content === "string" ? content : JSON.stringify(content),
  });
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    throw new Error(await parseResponseError(response));
  }
  return { ok: true, status: response.status };
}

export async function downloadFile(config, path, { fetchImpl = globalThis.fetch } = {}) {
  ensureConfig(config);
  const url = buildUrl(config, path);
  const headers = buildHeaders(config);
  const response = await fetchImpl(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }
  const text = await response.text();
  return text;
}

export async function fileExists(config, path, { fetchImpl = globalThis.fetch } = {}) {
  ensureConfig(config);
  const url = buildUrl(config, path);
  const headers = buildHeaders(config);
  const response = await fetchImpl(url, { method: "HEAD", headers });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(await parseResponseError(response));
}

export async function deleteFile(config, path, { fetchImpl = globalThis.fetch } = {}) {
  ensureConfig(config);
  const url = buildUrl(config, path);
  const headers = buildHeaders(config);
  const response = await fetchImpl(url, { method: "DELETE", headers });
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    throw new Error(await parseResponseError(response));
  }
  return { ok: true, status: response.status };
}

export function createWebdavClient(config) {
  return {
    upload: (path, content, options) => uploadFile(config, path, content, options),
    download: (path, options) => downloadFile(config, path, options),
    exists: (path, options) => fileExists(config, path, options),
    delete: (path, options) => deleteFile(config, path, options),
  };
}

export { buildUrl, buildHeaders };
