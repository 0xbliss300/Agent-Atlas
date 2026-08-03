import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBatchDrafts,
  createProjectsBatch,
  MAX_BATCH_DIRECTORIES,
  MAX_BATCH_RECORDS,
  parseBatchCsvText,
  parseBatchJsonText,
  scanParentDirectory,
  suggestUniqueName,
} from "./batchImport.js";
import { IMPORT_FIELD_STATUS } from "./projectImport.js";

function missingError() {
  const error = new Error("missing");
  error.name = "NotFoundError";
  return error;
}

function fileHandle(name, text, lastModified = 1_720_000_000_000) {
  return {
    async getFile() {
      return {
        name,
        lastModified,
        size: text.length,
        async text() {
          return text;
        },
      };
    },
  };
}

function directoryHandle(name, entries) {
  return {
    name,
    kind: "directory",
    async getFileHandle(key) {
      const entry = entries[key];
      if (!entry || entry.kind === "directory") throw missingError();
      return entry;
    },
    async getDirectoryHandle(key) {
      const entry = entries[key];
      if (!entry || entry.kind !== "directory") throw missingError();
      return entry;
    },
  };
}

function parentHandle(name, children) {
  const entries = new Map(children.map((child) => [child.name, child]));
  return {
    name,
    kind: "directory",
    async *values() {
      for (const child of children) {
        yield child;
      }
    },
    async getFileHandle(key) {
      const entry = entries.get(key);
      if (!entry || entry.kind === "directory") throw missingError();
      return entry;
    },
    async getDirectoryHandle(key) {
      const entry = entries.get(key);
      if (!entry || entry.kind !== "directory") throw missingError();
      return entry;
    },
  };
}

test("suggestUniqueName 在同名时追加序号，不冲突时原样返回", () => {
  assert.equal(suggestUniqueName("Agent", []), "Agent");
  assert.equal(suggestUniqueName("Agent", [{ name: "Agent" }]), "Agent (1)");
  assert.equal(suggestUniqueName("Agent", [{ name: "Agent" }, { name: "Agent (1)" }]), "Agent (2)");
});

test("parseBatchCsvText 解析表头与多行数据，支持引号包裹", () => {
  const csv = [
    "name,short,status,progress,milestone",
    "Agent A,第一个项目,active,30,初始化",
    '"Agent, B","含逗号的简介",planned,0,起步',
  ].join("\n");
  const { records, sourceName } = parseBatchCsvText(csv, "demo.csv");
  assert.equal(sourceName, "demo.csv");
  assert.equal(records.length, 2);
  assert.equal(records[0].name, "Agent A");
  assert.equal(records[0].status, "active");
  assert.equal(records[1].name, "Agent, B");
  assert.equal(records[1].short, "含逗号的简介");
  assert.equal(records[1].status, "planned");
});

test("parseBatchCsvText 拒绝空内容、缺少数据行与未知列", () => {
  assert.throws(() => parseBatchCsvText("", "empty.csv"), /没有可解析的内容/);
  assert.throws(() => parseBatchCsvText("name,short", "header.csv"), /至少需要表头与一条数据/);
  assert.throws(() => parseBatchCsvText("unknown,short\nx,y", "bad.csv"), /不支持的列：unknown/);
});

test("parseBatchJsonText 支持对象数组与 projects 包装", () => {
  const arrayForm = JSON.stringify([{ name: "A" }, { name: "B" }]);
  const { records: arrayRecords } = parseBatchJsonText(arrayForm, "a.json");
  assert.equal(arrayRecords.length, 2);

  const wrappedForm = JSON.stringify({ projects: [{ name: "C" }] });
  const { records: wrappedRecords } = parseBatchJsonText(wrappedForm, "c.json");
  assert.equal(wrappedRecords.length, 1);
  assert.equal(wrappedRecords[0].name, "C");
});

test("parseBatchJsonText 拒绝非 JSON 与不支持结构", () => {
  assert.throws(() => parseBatchJsonText("not json", "bad.json"), /不是有效的 JSON/);
  assert.throws(
    () => parseBatchJsonText('{"foo":"bar"}', "obj.json"),
    /应为对象数组或包含 projects 数组/,
  );
});

test("parseBatchCsvText 与 parseBatchJsonText 超过上限时拒绝", () => {
  const lines = ["name,short"];
  for (let i = 0; i < MAX_BATCH_RECORDS + 1; i += 1) {
    lines.push(`项目${i},简介${i}`);
  }
  assert.throws(() => parseBatchCsvText(lines.join("\n"), "big.csv"), /超过.*条上限/);
  const big = JSON.stringify(
    Array.from({ length: MAX_BATCH_RECORDS + 1 }, (_, i) => ({ name: `p${i}` })),
  );
  assert.throws(() => parseBatchJsonText(big, "big.json"), /超过.*条上限/);
});

test("buildBatchDrafts 从 CSV 记录生成草稿、字段状态与同名警告", () => {
  const { items, errors } = buildBatchDrafts(
    [
      { name: "Agent A", short: "简介 A", status: "active", progress: "40", milestone: "M1" },
      { name: "Agent B", short: "简介 B", status: "unknown", progress: "非数字" },
    ],
    [{ name: "Agent A" }],
    { sourceType: "csv", sourceName: "demo.csv" },
  );
  assert.equal(errors.length, 0);
  assert.equal(items.length, 2);
  assert.equal(items[0].draft.name, "Agent A");
  assert.equal(items[0].draft.status, "active");
  assert.equal(items[0].draft.progress, "40");
  assert.equal(items[0].duplicateName, true);
  assert.match(items[0].suggestedName, /Agent A \(1\)/);
  assert.equal(items[0].fieldStatus.name, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(items[0].fieldStatus.short, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(items[0].sourceMetadata.sourceType, "csv");
  assert.equal(items[1].draft.status, "planning");
  assert.equal(items[1].draft.progress, "0");
  assert.equal(items[1].fieldStatus.status, IMPORT_FIELD_STATUS.MISSING);
  assert.equal(items[1].fieldStatus.progress, IMPORT_FIELD_STATUS.MISSING);
  assert.equal(items[1].fieldStatus.milestone, IMPORT_FIELD_STATUS.MISSING);
  assert.equal(items[1].duplicateName, false);
});

test("buildBatchDrafts 从 JSON 记录支持数组字段与别名状态", () => {
  const { items } = buildBatchDrafts(
    [
      {
        name: "Agent J",
        status: "completed",
        progress: 100,
        languages: ["TypeScript", "Python"],
        frameworks: ["React"],
        tags: ["agent", "local"],
      },
    ],
    [],
    { sourceType: "json", sourceName: "demo.json" },
  );
  assert.equal(items[0].draft.status, "done");
  assert.equal(items[0].draft.progress, "100");
  assert.equal(items[0].draft.languagesText, "TypeScript, Python");
  assert.equal(items[0].draft.frameworksText, "React");
  assert.equal(items[0].draft.tagsText, "agent, local");
  assert.equal(items[0].fieldStatus.languagesText, IMPORT_FIELD_STATUS.DETECTED);
});

test("buildBatchDrafts 空记录抛出错误", () => {
  assert.throws(
    () => buildBatchDrafts([], [], { sourceType: "csv", sourceName: "x.csv" }),
    /没有可用于生成草稿的记录/,
  );
});

test("scanParentDirectory 扫描多个子目录并跳过无白名单文件的目录", async () => {
  const parent = parentHandle("projects", [
    directoryHandle("agent-a", {
      "README.md": fileHandle("README.md", "# Agent A\n\n第一个 Agent。"),
      "package.json": fileHandle(
        "package.json",
        JSON.stringify({ name: "agent-a", description: "A" }),
      ),
    }),
    directoryHandle("empty-dir", {}),
    directoryHandle("agent-b", {
      "README.md": fileHandle("README.md", "# Agent B\n\n第二个 Agent。"),
    }),
  ]);
  const { results, errors } = await scanParentDirectory(parent, []);
  assert.equal(results.length, 2);
  assert.equal(results[0].draft.name, "Agent A");
  assert.equal(results[1].draft.name, "Agent B");
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /没有找到/);
  assert.equal(errors[0].sourceName, "empty-dir");
});

test("scanParentDirectory 无子目录时抛出错误", async () => {
  const parent = parentHandle("empty-parent", []);
  await assert.rejects(() => scanParentDirectory(parent, []), /没有子目录/);
});

test("scanParentDirectory 子目录数超过上限时抛出错误", async () => {
  const children = Array.from({ length: MAX_BATCH_DIRECTORIES + 1 }, (_, i) =>
    directoryHandle(`dir-${i}`, {}),
  );
  const parent = parentHandle("too-many", children);
  await assert.rejects(() => scanParentDirectory(parent, []), /最多支持/);
});

test("createProjectsBatch 批量创建成功并避免 ID 冲突", () => {
  const drafts = [
    {
      key: "csv-0",
      sourceName: "demo.csv",
      draft: {
        name: "Agent A",
        short: "简介 A",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: { sourceType: "csv", sourceName: "demo.csv" },
    },
    {
      key: "csv-1",
      sourceName: "demo.csv",
      draft: {
        name: "Agent B",
        short: "简介 B",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: { sourceType: "csv", sourceName: "demo.csv" },
    },
  ];
  const { created, failed, nextProjects } = createProjectsBatch(drafts, ["csv-0", "csv-1"], []);
  assert.equal(created.length, 2);
  assert.equal(failed.length, 0);
  assert.equal(nextProjects.length, 2);
  assert.notEqual(created[0].id, created[1].id);
});

test("createProjectsBatch 部分失败不影响已成功项", () => {
  const drafts = [
    {
      key: "csv-0",
      sourceName: "demo.csv",
      draft: {
        name: "Valid Agent",
        short: "有效",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: null,
    },
    {
      key: "csv-1",
      sourceName: "demo.csv",
      draft: {
        name: "",
        short: "无效",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: null,
    },
  ];
  const { created, failed } = createProjectsBatch(drafts, ["csv-0", "csv-1"], []);
  assert.equal(created.length, 1);
  assert.equal(created[0].name, "Valid Agent");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].key, "csv-1");
  assert.match(failed[0].message, /请输入项目名称/);
});

test("createProjectsBatch 未选中的草稿不会被创建", () => {
  const drafts = [
    {
      key: "csv-0",
      sourceName: "demo.csv",
      draft: {
        name: "Selected",
        short: "已选",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: null,
    },
    {
      key: "csv-1",
      sourceName: "demo.csv",
      draft: {
        name: "Skipped",
        short: "未选",
        status: "planning",
        progress: "0",
        milestone: "起步",
      },
      sourceMetadata: null,
    },
  ];
  const { created, failed } = createProjectsBatch(drafts, ["csv-0"], []);
  assert.equal(created.length, 1);
  assert.equal(created[0].name, "Selected");
  assert.equal(failed.length, 0);
});
