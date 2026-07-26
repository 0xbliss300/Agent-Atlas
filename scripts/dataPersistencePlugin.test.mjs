import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDataFileStore } from "./dataPersistencePlugin.mjs";

async function withStore(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-atlas-data-"));
  try {
    const store = createDataFileStore(root);
    await run(store, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("初始化时创建分类目录和版本元数据", async () => {
  await withStore(async (store, root) => {
    await store.initialize();
    const schema = JSON.parse(await readFile(path.join(root, "data/meta/schema.json"), "utf8"));
    assert.equal(schema.schemaVersion, 1);
    assert.equal(schema.datasets.projects, "projects/projects.json");

    const snapshot = await store.readSnapshot();
    assert.equal(snapshot.errors.length, 0);
    assert.equal(snapshot.datasets["agent-project-showcase.projects.v1"], null);
  });
});

test("项目数据按分类原子写入、更新并可重启读取", async () => {
  await withStore(async (store, root) => {
    const first = JSON.stringify({ schemaVersion: 1, projects: [{ id: "one" }] });
    const second = JSON.stringify({ schemaVersion: 1, projects: [{ id: "two" }] });
    await store.writeDataset("projects", first);
    await store.writeDataset("projects", second);

    const restarted = createDataFileStore(root);
    assert.deepEqual(JSON.parse(await restarted.readDataset("projects")), JSON.parse(second));
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, "data/projects/projects.json"), "utf8")),
      JSON.parse(second),
    );
  });
});

test("旧浏览器数据迁移只补充缺失分类且保持幂等", async () => {
  await withStore(async (store, root) => {
    const projects = JSON.stringify({ schemaVersion: 1, projects: [] });
    const settings = JSON.stringify({ schemaVersion: 1, settings: { density: "compact" } });
    const first = await store.migrate({
      "agent-project-showcase.projects.v1": projects,
      "agent-project-showcase.settings.v1": settings,
    });
    const second = await store.migrate({
      "agent-project-showcase.projects.v1": JSON.stringify({
        schemaVersion: 1,
        projects: [{ id: "must-not-overwrite" }],
      }),
    });

    assert.equal(first.migratedCount, 2);
    assert.equal(second.migratedCount, 0);
    assert.deepEqual(JSON.parse(await store.readDataset("projects")), JSON.parse(projects));
    const migration = JSON.parse(
      await readFile(path.join(root, "data/meta/migration.json"), "utf8"),
    );
    assert.equal(migration.legacyDataPreserved, true);
  });
});

test("损坏文件被保留并在快照中单独报告", async () => {
  await withStore(async (store, root) => {
    await store.initialize();
    const target = path.join(root, "data/projects/projects.json");
    await writeFile(target, "{broken-json", "utf8");

    const snapshot = await store.readSnapshot();
    assert.equal(snapshot.datasets["agent-project-showcase.projects.v1"], null);
    assert.equal(snapshot.errors[0].dataset, "projects");
    assert.equal(await readFile(target, "utf8"), "{broken-json");

    await store.writeDataset("projects", JSON.stringify({ schemaVersion: 1, projects: [] }));
    assert.deepEqual(JSON.parse(await readFile(target, "utf8")), {
      schemaVersion: 1,
      projects: [],
    });
    const entries = await import("node:fs/promises").then(({ readdir }) =>
      readdir(path.dirname(target)),
    );
    const preserved = entries.find((name) => name.startsWith("projects.json.corrupt-"));
    assert.ok(preserved);
    assert.equal(
      await readFile(path.join(path.dirname(target), preserved), "utf8"),
      "{broken-json",
    );
  });
});

test("未知分类和非法 JSON 会被拒绝且不能生成任意路径", async () => {
  await withStore(async (store, root) => {
    await assert.rejects(() => store.writeDataset("../outside", "{}"), /未知的数据分类/);
    await assert.rejects(() => store.writeDataset("projects", "{broken"), /JSON/);
    await assert.rejects(
      () => store.writeDataset("projects", "x".repeat(8 * 1024 * 1024 + 1)),
      /8 MB/,
    );
    await assert.rejects(() => readFile(path.join(root, "outside"), "utf8"));
  });
});
