import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSyncPayload,
  encryptSyncPayload,
  decryptSyncPayload,
  mergeRemotePayload,
  isRemoteNewer,
  pushToRemote,
  pullFromRemote,
  SYNC_PAYLOAD_VERSION,
} from "./e2eSync.js";

function mockResponse(status, body = "") {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body;
    },
  };
}

const emptyStores = {
  projects: [],
  notes: [],
  histories: [],
  events: [],
  templates: [],
  collections: [],
  trashEntries: [],
  evaluations: [],
};

test("buildSyncPayload 构建带版本号的载荷", async () => {
  const payload = await buildSyncPayload(emptyStores, {
    deviceId: "device-1",
    now: new Date("2026-08-03T10:00:00+08:00"),
  });
  assert.equal(payload.v, SYNC_PAYLOAD_VERSION);
  assert.equal(payload.deviceId, "device-1");
  assert.equal(payload.pushedAt, "2026-08-03T02:00:00.000Z");
  assert.ok(payload.backup);
  assert.ok(Array.isArray(payload.backup.projects));
});

test("buildSyncPayload 未提供 deviceId 时自动生成", async () => {
  const payload = await buildSyncPayload(emptyStores);
  assert.ok(payload.deviceId);
  assert.match(payload.deviceId, /^[0-9a-f]{16}$/);
});

test("encryptSyncPayload 与 decryptSyncPayload 往返一致", async () => {
  const payload = await buildSyncPayload(emptyStores, { deviceId: "dev" });
  const encrypted = await encryptSyncPayload(payload, "password");
  const decrypted = await decryptSyncPayload(encrypted, "password");
  assert.equal(decrypted.deviceId, "dev");
  assert.equal(decrypted.v, SYNC_PAYLOAD_VERSION);
  assert.ok(decrypted.backup);
});

test("decryptSyncPayload 拒绝不支持的版本", async () => {
  await assert.rejects(decryptSyncPayload({ v: 99, backup: {} }, "pw"), /不支持的同步载荷版本/);
});

test("decryptSyncPayload 拒绝缺少备份数据的载荷", async () => {
  await assert.rejects(decryptSyncPayload({ v: SYNC_PAYLOAD_VERSION }, "pw"), /缺少备份数据/);
});

test("mergeRemotePayload 使用 merge 策略合并远端与本地", async () => {
  const remotePayload = {
    v: SYNC_PAYLOAD_VERSION,
    deviceId: "remote-dev",
    pushedAt: "2026-08-03T02:00:00.000Z",
    backup: {
      schemaVersion: 1,
      projects: [
        {
          id: "remote-1",
          name: "Remote Agent",
          short: "远端项目",
          status: "planning",
          progress: 0,
          milestone: "起步",
          tags: [],
          pinned: false,
          collectionIds: [],
          blockers: [],
          nextTasks: [],
          technology: {
            languages: [],
            frameworks: [],
            models: [],
            dataSources: [],
            runCommand: "",
          },
          logText: "",
          updatedAt: "2026-08-03T02:00:00.000+08:00",
        },
      ],
    },
  };
  const result = mergeRemotePayload(remotePayload, emptyStores, { strategy: "merge" });
  assert.ok(result.projects);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, "Remote Agent");
});

test("mergeRemotePayload 拒绝未知策略", () => {
  assert.throws(
    () => mergeRemotePayload({ backup: {} }, emptyStores, { strategy: "unknown" }),
    /未知的同步策略/,
  );
});

test("isRemoteNewer 比较 pushedAt 与 lastSyncedAt", () => {
  const remote = { pushedAt: "2026-08-03T03:00:00.000Z" };
  assert.equal(isRemoteNewer(remote, "2026-08-03T02:00:00.000Z"), true);
  assert.equal(isRemoteNewer(remote, "2026-08-03T04:00:00.000Z"), false);
  assert.equal(isRemoteNewer(remote, ""), true);
  assert.equal(isRemoteNewer({ pushedAt: "" }, "2026-08-03T02:00:00.000Z"), false);
});

test("pushToRemote 加密上传并返回 pushedAt", async () => {
  const fetchImpl = async () => mockResponse(201);
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/agent-atlas/",
    username: "user",
    password: "pass",
    filePath: "/sync.enc.json",
    deviceId: "dev-1",
  };
  const result = await pushToRemote(emptyStores, config, "secret", {
    fetchImpl,
    now: new Date("2026-08-03T10:00:00+08:00"),
  });
  assert.ok(result.pushedAt);
  assert.equal(result.deviceId, "dev-1");
});

test("pushToRemote 空口令抛出错误", async () => {
  await assert.rejects(
    pushToRemote(emptyStores, { baseUrl: "https://dav.example.com", filePath: "/x" }, ""),
    /请输入加密口令/,
  );
});

test("pushToRemote 上传失败抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(401);
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/",
    username: "user",
    password: "pass",
    filePath: "/sync.enc.json",
    deviceId: "dev-1",
  };
  await assert.rejects(pushToRemote(emptyStores, config, "secret", { fetchImpl }), /认证失败/);
});

test("pullFromRemote 下载、解密并合并", async () => {
  const stores = {
    ...emptyStores,
    projects: [],
  };
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/agent-atlas/",
    username: "user",
    password: "pass",
    filePath: "/sync.enc.json",
    deviceId: "dev-1",
  };

  // 先推送以生成远端密文
  const pushed = await pushToRemote({ ...emptyStores, projects: [] }, config, "secret", {
    fetchImpl: async () => mockResponse(201),
    now: new Date("2026-08-03T10:00:00+08:00"),
  });
  assert.ok(pushed.pushedAt);

  // 构造一个带项目的远端载荷
  const remotePayload = {
    v: SYNC_PAYLOAD_VERSION,
    deviceId: "dev-1",
    pushedAt: "2026-08-03T02:00:00.000Z",
    backup: {
      schemaVersion: 1,
      projects: [
        {
          id: "p1",
          name: "Test Agent",
          short: "测试",
          status: "planning",
          progress: 0,
          milestone: "起步",
          tags: [],
          pinned: false,
          collectionIds: [],
          blockers: [],
          nextTasks: [],
          technology: {
            languages: [],
            frameworks: [],
            models: [],
            dataSources: [],
            runCommand: "",
          },
          logText: "",
          updatedAt: "2026-08-03T10:00:00.000+08:00",
        },
      ],
    },
  };
  const encrypted = await encryptSyncPayload(remotePayload, "secret");
  const fetchImpl = async () => mockResponse(200, JSON.stringify(encrypted));

  const { result, remotePayload: pulledPayload } = await pullFromRemote(stores, config, "secret", {
    fetchImpl,
    strategy: "merge",
  });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].name, "Test Agent");
  assert.equal(pulledPayload.deviceId, "dev-1");
});

test("pullFromRemote 远端返回非 JSON 抛出错误", async () => {
  const fetchImpl = async () => mockResponse(200, "not json");
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/",
    username: "user",
    password: "pass",
    filePath: "/sync.enc.json",
    deviceId: "dev-1",
  };
  await assert.rejects(
    pullFromRemote(emptyStores, config, "secret", { fetchImpl }),
    /不是有效的 JSON/,
  );
});

test("pullFromRemote 口令错误抛出解密失败", async () => {
  const remotePayload = {
    v: SYNC_PAYLOAD_VERSION,
    deviceId: "dev-1",
    pushedAt: "2026-08-03T02:00:00.000Z",
    backup: { schemaVersion: 1, projects: [] },
  };
  const encrypted = await encryptSyncPayload(remotePayload, "correct-password");
  const fetchImpl = async () => mockResponse(200, JSON.stringify(encrypted));
  const config = {
    baseUrl: "https://dav.example.com",
    basePath: "/",
    username: "user",
    password: "pass",
    filePath: "/sync.enc.json",
    deviceId: "dev-1",
  };
  await assert.rejects(
    pullFromRemote(emptyStores, config, "wrong-password", { fetchImpl }),
    /解密失败/,
  );
});
