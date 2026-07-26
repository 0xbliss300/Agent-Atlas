import { constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FILE_DATA_SCHEMA_VERSION,
  FILE_DATASET_BY_ID,
  FILE_DATASETS,
} from "../src/data/fileDatasets.js";

const API_PREFIX = "/api/data";
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function exists(target) {
  try {
    await access(target, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertNotSymlink(target) {
  if (!(await exists(target))) return;
  const stat = await lstat(target);
  if (stat.isSymbolicLink()) throw new Error("拒绝写入符号链接目标。");
}

async function atomicWriteJson(target, payload, dataRootReal) {
  const parent = path.dirname(target);
  await mkdir(parent, { recursive: true });
  const parentReal = await realpath(parent);
  if (!isWithin(dataRootReal, parentReal)) throw new Error("数据路径越出 data 目录。");
  await assertNotSymlink(target);

  const temporary = path.join(
    parentReal,
    `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export function createDataFileStore(projectRoot) {
  const root = path.resolve(projectRoot);
  const dataRoot = path.join(root, "data");

  const initialize = async () => {
    await mkdir(dataRoot, { recursive: true });
    const rootReal = await realpath(root);
    const dataRootReal = await realpath(dataRoot);
    if (!isWithin(rootReal, dataRootReal)) throw new Error("data 目录不能指向项目外部。");

    for (const dataset of FILE_DATASETS) {
      const datasetDirectory = path.dirname(path.join(dataRootReal, dataset.relativePath));
      await mkdir(datasetDirectory, { recursive: true });
      const datasetDirectoryReal = await realpath(datasetDirectory);
      if (!isWithin(dataRootReal, datasetDirectoryReal)) {
        throw new Error("数据分类目录不能指向 data 外部。");
      }
    }

    const metaPath = path.join(dataRootReal, "meta", "schema.json");
    if (!(await exists(metaPath))) {
      await atomicWriteJson(
        metaPath,
        {
          schemaVersion: FILE_DATA_SCHEMA_VERSION,
          storage: "categorized-files",
          datasets: Object.fromEntries(
            FILE_DATASETS.map(({ id, relativePath }) => [id, relativePath]),
          ),
        },
        dataRootReal,
      );
    }
    return { rootReal, dataRootReal };
  };

  const resolveDatasetPath = async (datasetId) => {
    const dataset = FILE_DATASET_BY_ID[datasetId];
    if (!dataset) throw new Error("未知的数据分类。");
    const { dataRootReal } = await initialize();
    const parent = path.dirname(path.resolve(dataRootReal, dataset.relativePath));
    const parentReal = await realpath(parent);
    if (!isWithin(dataRootReal, parentReal)) throw new Error("数据路径越出 data 目录。");
    const target = path.join(parentReal, path.basename(dataset.relativePath));
    if (!isWithin(dataRootReal, target)) throw new Error("数据路径越出 data 目录。");
    return { dataset, target, dataRootReal };
  };

  const readDataset = async (datasetId) => {
    const { target } = await resolveDatasetPath(datasetId);
    if (!(await exists(target))) return null;
    await assertNotSymlink(target);
    const raw = await readFile(target, "utf8");
    return JSON.stringify(JSON.parse(raw));
  };

  const writeDataset = async (datasetId, rawValue) => {
    if (typeof rawValue !== "string") throw new Error("数据内容必须是 JSON 字符串。");
    if (Buffer.byteLength(rawValue, "utf8") > MAX_REQUEST_BYTES) {
      throw new Error("数据内容超过 8 MB 限制。");
    }
    const parsed = JSON.parse(rawValue);
    const { target, dataRootReal } = await resolveDatasetPath(datasetId);
    if (await exists(target)) {
      await assertNotSymlink(target);
      try {
        JSON.parse(await readFile(target, "utf8"));
      } catch {
        const preserved = `${target}.corrupt-${Date.now()}`;
        await rename(target, preserved);
      }
    }
    await atomicWriteJson(target, parsed, dataRootReal);
  };

  const removeDataset = async (datasetId) => {
    const { target } = await resolveDatasetPath(datasetId);
    await assertNotSymlink(target);
    await rm(target, { force: true });
  };

  const readSnapshot = async () => {
    const datasets = {};
    const errors = [];
    for (const dataset of FILE_DATASETS) {
      try {
        datasets[dataset.storageKey] = await readDataset(dataset.id);
      } catch (error) {
        datasets[dataset.storageKey] = null;
        errors.push({ dataset: dataset.id, message: error.message || "数据文件无法读取。" });
      }
    }
    return { schemaVersion: FILE_DATA_SCHEMA_VERSION, datasets, errors };
  };

  const migrate = async (values, legacyStorageKeys = Object.keys(values ?? {})) => {
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      throw new Error("迁移数据格式无效。");
    }
    let migratedCount = 0;
    let initializedCount = 0;
    const legacyKeys = new Set(legacyStorageKeys);
    for (const dataset of FILE_DATASETS) {
      const rawValue = values[dataset.storageKey];
      if (typeof rawValue !== "string") continue;
      const current = await readDataset(dataset.id);
      if (current !== null) continue;
      await writeDataset(dataset.id, rawValue);
      if (legacyKeys.has(dataset.storageKey)) migratedCount += 1;
      else initializedCount += 1;
    }
    const { dataRootReal } = await initialize();
    await atomicWriteJson(
      path.join(dataRootReal, "meta", "migration.json"),
      {
        schemaVersion: FILE_DATA_SCHEMA_VERSION,
        source: "legacy-localStorage",
        migratedAt: new Date().toISOString(),
        migratedCount,
        initializedCount,
        legacyDataPreserved: true,
      },
      dataRootReal,
    );
    return { migratedCount, initializedCount };
  };

  return {
    dataRoot,
    initialize,
    readDataset,
    writeDataset,
    removeDataset,
    readSnapshot,
    migrate,
  };
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_REQUEST_BYTES) throw new Error("请求内容超过 8 MB 限制。");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function isSameOriginRequest(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

export function createDataApiMiddleware(projectRoot) {
  const store = createDataFileStore(projectRoot);

  return async function dataApi(request, response, next) {
    const url = new URL(request.url, "http://local.agent-atlas");
    if (!url.pathname.startsWith(API_PREFIX)) return next();
    if (!isSameOriginRequest(request)) {
      sendJson(response, 403, { error: "拒绝跨来源数据写入。" });
      return;
    }

    try {
      if (url.pathname === `${API_PREFIX}/snapshot` && request.method === "GET") {
        sendJson(response, 200, await store.readSnapshot());
        return;
      }
      if (url.pathname === `${API_PREFIX}/migrate` && request.method === "POST") {
        const body = await readJsonBody(request);
        sendJson(response, 200, await store.migrate(body.datasets, body.legacyStorageKeys));
        return;
      }

      const match = url.pathname.match(/^\/api\/data\/dataset\/([a-z-]+)$/);
      const datasetId = match?.[1];
      if (datasetId && request.method === "PUT") {
        const body = await readJsonBody(request);
        await store.writeDataset(datasetId, body.value);
        sendJson(response, 200, { ok: true, dataset: datasetId });
        return;
      }
      if (datasetId && request.method === "DELETE") {
        await store.removeDataset(datasetId);
        sendJson(response, 200, { ok: true, dataset: datasetId });
        return;
      }

      sendJson(response, 404, { error: "数据接口不存在。" });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "本地数据操作失败。" });
    }
  };
}

export function dataPersistencePlugin() {
  const install = (server) => {
    server.middlewares.use(createDataApiMiddleware(server.config.root));
  };
  return {
    name: "agent-atlas-file-persistence",
    configureServer: install,
    configurePreviewServer: install,
  };
}
