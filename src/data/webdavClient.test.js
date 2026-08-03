import test from "node:test";
import assert from "node:assert/strict";
import {
  uploadFile,
  downloadFile,
  fileExists,
  deleteFile,
  createWebdavClient,
  buildUrl,
  buildHeaders,
} from "./webdavClient.js";

function mockResponse(status, body = "") {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body;
    },
  };
}

const baseConfig = {
  baseUrl: "https://dav.example.com",
  basePath: "/agent-atlas/",
  username: "user",
  password: "pass",
};

test("buildUrl 拼接 baseUrl、basePath 与文件路径", () => {
  const url = buildUrl(baseConfig, "/sync.enc.json");
  assert.equal(url, "https://dav.example.com/agent-atlas/sync.enc.json");
});

test("buildUrl 处理尾部斜杠与无 basePath 的情况", () => {
  assert.equal(
    buildUrl({ baseUrl: "https://dav.example.com/", basePath: "" }, "/file.json"),
    "https://dav.example.com/file.json",
  );
  assert.equal(
    buildUrl({ baseUrl: "https://dav.example.com", basePath: "/path" }, "file.json"),
    "https://dav.example.com/path/file.json",
  );
});

test("buildHeaders 添加 Basic 认证头", () => {
  const headers = buildHeaders(baseConfig, { "Content-Type": "application/json" });
  assert.equal(headers["Content-Type"], "application/json");
  assert.match(headers.Authorization, /^Basic /);
  const decoded = globalThis.atob(headers.Authorization.slice(6));
  assert.equal(decoded, "user:pass");
});

test("buildHeaders 无凭证时不添加 Authorization", () => {
  const headers = buildHeaders({ baseUrl: "https://dav.example.com" });
  assert.equal(headers.Authorization, undefined);
});

test("uploadFile 成功上传并返回 ok", async () => {
  const fetchImpl = async () => mockResponse(201);
  const result = await uploadFile(baseConfig, "/sync.json", '{"data":1}', { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.status, 201);
});

test("uploadFile 204 也视为成功", async () => {
  const fetchImpl = async () => mockResponse(204);
  const result = await uploadFile(baseConfig, "/sync.json", "data", { fetchImpl });
  assert.equal(result.ok, true);
});

test("uploadFile 认证失败抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(401);
  await assert.rejects(uploadFile(baseConfig, "/sync.json", "data", { fetchImpl }), /认证失败/);
});

test("uploadFile 服务器错误抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(500);
  await assert.rejects(uploadFile(baseConfig, "/sync.json", "data", { fetchImpl }), /服务器错误/);
});

test("downloadFile 成功下载返回文本", async () => {
  const fetchImpl = async () => mockResponse(200, '{"encrypted":true}');
  const text = await downloadFile(baseConfig, "/sync.json", { fetchImpl });
  assert.equal(text, '{"encrypted":true}');
});

test("downloadFile 404 抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(404);
  await assert.rejects(downloadFile(baseConfig, "/sync.json", { fetchImpl }), /不存在/);
});

test("fileExists 200 返回 true", async () => {
  const fetchImpl = async () => mockResponse(200);
  const exists = await fileExists(baseConfig, "/sync.json", { fetchImpl });
  assert.equal(exists, true);
});

test("fileExists 404 返回 false", async () => {
  const fetchImpl = async () => mockResponse(404);
  const exists = await fileExists(baseConfig, "/sync.json", { fetchImpl });
  assert.equal(exists, false);
});

test("deleteFile 成功删除返回 ok", async () => {
  const fetchImpl = async () => mockResponse(204);
  const result = await deleteFile(baseConfig, "/sync.json", { fetchImpl });
  assert.equal(result.ok, true);
});

test("deleteFile 404 也视为成功（幂等）", async () => {
  const fetchImpl = async () => mockResponse(404);
  const result = await deleteFile(baseConfig, "/sync.json", { fetchImpl });
  assert.equal(result.ok, true);
});

test("缺少 baseUrl 抛出错误", async () => {
  await assert.rejects(uploadFile({ basePath: "/" }, "/file", "data"), /baseUrl 未配置/);
});

test("非法协议抛出错误", async () => {
  await assert.rejects(
    uploadFile({ baseUrl: "ftp://dav.example.com" }, "/file", "data"),
    /http 或 https/,
  );
});

test("createWebdavClient 返回包含四个方法的对象", () => {
  const client = createWebdavClient(baseConfig);
  assert.equal(typeof client.upload, "function");
  assert.equal(typeof client.download, "function");
  assert.equal(typeof client.exists, "function");
  assert.equal(typeof client.delete, "function");
});
