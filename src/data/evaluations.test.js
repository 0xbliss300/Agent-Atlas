import test from "node:test";
import assert from "node:assert/strict";
import {
  createEvaluationInputDate,
  createEvaluationRecord,
  deleteEvaluationRecord,
  deleteEvaluationsForProject,
  EMPTY_EVALUATION_DRAFT,
  EVALUATION_SCHEMA_VERSION,
  EVALUATION_STORAGE_KEY,
  groupEvaluationsByMetric,
  importEvaluationBackup,
  loadEvaluationStore,
  normalizeEvaluation,
  saveEvaluationStore,
  selectProjectEvaluations,
  sortEvaluations,
  updateEvaluationRecord,
  validateEvaluationDraft,
} from "./evaluations.js";
import { createProjectRecord, EMPTY_PROJECT_DRAFT } from "./projects.js";

function projectDraft(name = "评测项目") {
  return {
    ...EMPTY_PROJECT_DRAFT,
    name,
    short: "评测测试",
    milestone: "完成基线",
    status: "active",
    progress: "40",
  };
}

function draft(overrides = {}) {
  return {
    ...EMPTY_EVALUATION_DRAFT,
    metric: "准确率",
    value: "92.3%",
    evaluatedAt: "2026-08-01",
    ...overrides,
  };
}

function memoryStorage(initial = null) {
  return {
    value: initial,
    getItem(key) {
      return key === EVALUATION_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === EVALUATION_STORAGE_KEY) this.value = value;
    },
  };
}

test("normalizeEvaluation 解析数值并补齐派生时间字段", () => {
  const evaluation = normalizeEvaluation({
    id: "eval-1",
    projectId: "project-1",
    metric: "延迟",
    value: "1.2s",
    evaluatedAt: "2026-08-01T10:00:00+08:00",
    note: "首版基线",
    createdAt: "2026-08-01T10:05:00+08:00",
  });
  assert.equal(evaluation.numericValue, 1.2);
  assert.equal(evaluation.evaluated, "2026-08-01");
  assert.equal(evaluation.evaluatedTimestamp, Date.parse("2026-08-01T10:00:00+08:00"));
  assert.equal(evaluation.createdTimestamp, Date.parse("2026-08-01T10:05:00+08:00"));
  assert.ok(Object.isFrozen(evaluation));
});

test("normalizeEvaluation 解析带前缀/后缀/千分位的数值，无法解析时返回 null", () => {
  const cases = [
    ["85%", 85],
    ["~$0.012/次", 0.012],
    ["1,234.56", 1234.56],
    ["2.5e3", 2500],
    ["无可解析数值", null],
  ];
  for (const [value, expected] of cases) {
    const evaluation = normalizeEvaluation({
      id: "eval-x",
      projectId: "project-1",
      metric: "指标",
      value,
      evaluatedAt: "2026-08-01T10:00:00+08:00",
      createdAt: "2026-08-01T10:05:00+08:00",
    });
    assert.equal(evaluation.numericValue, expected, `数值 ${value} 应解析为 ${expected}`);
  }
});

test("normalizeEvaluation 缺字段或时间戳无效时抛出明确错误", () => {
  assert.throws(
    () =>
      normalizeEvaluation({
        id: "",
        projectId: "project-1",
        metric: "准确率",
        value: "92",
        evaluatedAt: "2026-08-01T10:00:00+08:00",
        createdAt: "2026-08-01T10:05:00+08:00",
      }),
    /缺少必要字段/,
  );
  assert.throws(
    () =>
      normalizeEvaluation({
        id: "eval-1",
        projectId: "project-1",
        metric: "准确率",
        value: "92",
        evaluatedAt: "not-a-date",
        createdAt: "2026-08-01T10:05:00+08:00",
      }),
    /时间戳无效/,
  );
});

test("validateEvaluationDraft 校验项目、指标与数值", () => {
  const project = createProjectRecord(projectDraft(), []);
  assert.deepEqual(validateEvaluationDraft(draft({ projectId: project.id }), [project]), {});
  assert.match(
    validateEvaluationDraft(draft({ projectId: "" }), [project]).projectId,
    /请选择评测所属项目/,
  );
  assert.match(
    validateEvaluationDraft(draft({ projectId: "missing" }), [project]).projectId,
    /所选项目不存在/,
  );
  assert.match(validateEvaluationDraft(draft({ metric: "" }), [project]).metric, /请输入指标名/);
  assert.match(validateEvaluationDraft(draft({ value: "" }), [project]).value, /请输入指标数值/);
});

test("createEvaluationRecord 创建记录并在校验失败时抛出带 fields 的错误", () => {
  const project = createProjectRecord(projectDraft(), []);
  const created = createEvaluationRecord(
    { ...draft(), projectId: project.id },
    [],
    [project],
    new Date("2026-08-01T09:00:00+08:00"),
  );
  assert.equal(created.projectId, project.id);
  assert.equal(created.metric, "准确率");
  assert.equal(created.numericValue, 92.3);
  assert.equal(created.evaluated, "2026-08-01");
  assert.ok(created.id);
  assert.ok(created.createdAt);

  assert.throws(
    () => createEvaluationRecord({ ...draft(), projectId: project.id, metric: "" }, [], [project]),
    /评测结果表单校验失败/,
  );
  try {
    createEvaluationRecord({ ...draft(), projectId: project.id, metric: "" }, [], [project]);
    assert.fail("空指标名应抛出校验错误");
  } catch (error) {
    assert.ok(error.fields?.metric);
  }

  const autoDate = createEvaluationRecord(
    { ...EMPTY_EVALUATION_DRAFT, projectId: project.id, metric: "成本", value: "$0.05" },
    [],
    [project],
    new Date("2026-08-02T12:00:00+08:00"),
  );
  assert.equal(autoDate.evaluated, "2026-08-02");
});

test("updateEvaluationRecord 编辑记录并保留未传入字段", () => {
  const project = createProjectRecord(projectDraft(), []);
  const created = createEvaluationRecord(
    { ...draft(), projectId: project.id },
    [],
    [project],
    new Date("2026-08-01T09:00:00+08:00"),
  );
  const updated = updateEvaluationRecord(
    created.id,
    { ...draft(), projectId: project.id, value: "95.1%", evaluatedAt: "2026-08-05" },
    [created],
    [project],
    new Date("2026-08-06T09:00:00+08:00"),
  );
  assert.equal(updated.value, "95.1%");
  assert.equal(updated.numericValue, 95.1);
  assert.equal(updated.evaluated, "2026-08-05");
  assert.equal(updated.metric, "准确率");

  assert.throws(
    () => updateEvaluationRecord("missing", draft({ projectId: project.id }), [created], [project]),
    /找不到需要编辑的评测结果/,
  );
});

test("deleteEvaluationRecord 与 deleteEvaluationsForProject 按范围移除", () => {
  const project = createProjectRecord(projectDraft(), []);
  const other = createProjectRecord(projectDraft("其他项目"), [project]);
  const a = createEvaluationRecord({ ...draft(), projectId: project.id }, [], [project, other]);
  const b = createEvaluationRecord(
    { ...draft({ metric: "延迟" }), projectId: other.id },
    [a],
    [project, other],
  );
  assert.equal(deleteEvaluationRecord(a.id, [a, b]).length, 1);
  assert.throws(() => deleteEvaluationRecord("missing", [a, b]), /找不到需要删除的评测结果/);
  assert.deepEqual(
    deleteEvaluationsForProject(project.id, [a, b]).map((item) => item.id),
    [b.id],
  );
});

test("sortEvaluations 与 selectProjectEvaluations 按评测时间升序并稳定排序", () => {
  const project = createProjectRecord(projectDraft(), []);
  const otherProject = { id: "other-project" };
  const early = createEvaluationRecord(
    { ...draft(), projectId: project.id, evaluatedAt: "2026-08-01" },
    [],
    [project, otherProject],
  );
  const later = createEvaluationRecord(
    { ...draft({ metric: "延迟" }), projectId: project.id, evaluatedAt: "2026-08-10" },
    [early],
    [project, otherProject],
  );
  const other = createEvaluationRecord(
    { ...draft(), projectId: "other-project", evaluatedAt: "2026-08-05" },
    [early, later],
    [project, otherProject],
  );
  assert.deepEqual(
    sortEvaluations([later, early, other]).map((item) => item.id),
    [early.id, other.id, later.id],
  );
  assert.deepEqual(
    selectProjectEvaluations([later, early, other], project.id).map((item) => item.id),
    [early.id, later.id],
  );
});

test("groupEvaluationsByMetric 按指标分组并保留时间序列", () => {
  const project = createProjectRecord(projectDraft(), []);
  const acc1 = createEvaluationRecord(
    { ...draft(), projectId: project.id, evaluatedAt: "2026-08-01" },
    [],
    [project],
  );
  const acc2 = createEvaluationRecord(
    { ...draft(), projectId: project.id, value: "94%", evaluatedAt: "2026-08-10" },
    [acc1],
    [project],
  );
  const latency = createEvaluationRecord(
    {
      ...draft({ metric: "延迟", value: "1.2s" }),
      projectId: project.id,
      evaluatedAt: "2026-08-05",
    },
    [acc1, acc2],
    [project],
  );
  const groups = groupEvaluationsByMetric([latency, acc2, acc1]);
  assert.deepEqual(
    groups.map((group) => group.metric),
    ["准确率", "延迟"],
  );
  assert.deepEqual(
    groups[0].items.map((item) => item.id),
    [acc1.id, acc2.id],
  );
});

test("importEvaluationBackup 合并导入并按项目 ID 映射", () => {
  const project = createProjectRecord(projectDraft(), []);
  const evaluation = createEvaluationRecord({ ...draft(), projectId: project.id }, [], [project]);
  const payload = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    evaluations: [evaluation],
  };
  const result = importEvaluationBackup(payload, [], [project], "merge", {});
  assert.equal(result.evaluations.length, 1);
  assert.equal(result.importedCount, 1);
  assert.equal(result.reassignedIds, 0);

  const remapped = importEvaluationBackup(payload, [], [project], "merge", {
    [project.id]: project.id,
  });
  assert.equal(remapped.evaluations[0].projectId, project.id);
});

test("importEvaluationBackup 在 ID 冲突时重新生成 ID 并保留记录", () => {
  const project = createProjectRecord(projectDraft(), []);
  const evaluation = createEvaluationRecord({ ...draft(), projectId: project.id }, [], [project]);
  const payload = {
    schemaVersion: EVALUATION_SCHEMA_VERSION,
    evaluations: [evaluation],
  };
  const result = importEvaluationBackup(payload, [evaluation], [project], "merge", {});
  assert.equal(result.evaluations.length, 2);
  assert.equal(new Set(result.evaluations.map((item) => item.id)).size, 2);
  assert.equal(result.importedCount, 1);
  assert.equal(result.reassignedIds, 1);
});

test("importEvaluationBackup 替换模式清空既有记录", () => {
  const project = createProjectRecord(projectDraft(), []);
  const existing = createEvaluationRecord(
    { ...draft({ metric: "旧指标" }), projectId: project.id },
    [],
    [project],
  );
  const incoming = createEvaluationRecord(
    { ...draft({ metric: "新指标" }), projectId: project.id },
    [],
    [project],
  );
  const result = importEvaluationBackup(
    { schemaVersion: EVALUATION_SCHEMA_VERSION, evaluations: [incoming] },
    [existing],
    [project],
    "replace",
    {},
  );
  assert.deepEqual(
    result.evaluations.map((item) => item.metric),
    ["新指标"],
  );
});

test("importEvaluationBackup 拒绝无效 JSON、不支持版本与缺失项目", () => {
  const project = createProjectRecord(projectDraft(), []);
  assert.throws(() => importEvaluationBackup("not-json", [], [project], "merge", {}), /JSON/);
  assert.throws(
    () =>
      importEvaluationBackup({ schemaVersion: 999, evaluations: [] }, [], [project], "merge", {}),
    /版本或结构不受支持/,
  );
  assert.throws(
    () =>
      importEvaluationBackup(
        {
          schemaVersion: EVALUATION_SCHEMA_VERSION,
          evaluations: [
            {
              id: "eval-1",
              projectId: "missing",
              metric: "准确率",
              value: "92",
              evaluatedAt: "2026-08-01T10:00:00+08:00",
              createdAt: "2026-08-01T10:05:00+08:00",
            },
          ],
        },
        [],
        [project],
        "merge",
        {},
      ),
    /关联的项目不存在/,
  );
  assert.throws(
    () =>
      importEvaluationBackup(
        {
          schemaVersion: EVALUATION_SCHEMA_VERSION,
          evaluations: [
            {
              id: "dup",
              projectId: project.id,
              metric: "准确率",
              value: "92",
              evaluatedAt: "2026-08-01T10:00:00+08:00",
              createdAt: "2026-08-01T10:05:00+08:00",
            },
            {
              id: "dup",
              projectId: project.id,
              metric: "准确率",
              value: "93",
              evaluatedAt: "2026-08-02T10:00:00+08:00",
              createdAt: "2026-08-02T10:05:00+08:00",
            },
          ],
        },
        [],
        [project],
        "merge",
        {},
      ),
    /重复评测结果 ID/,
  );
});

test("评测结果独立持久化，旧环境与损坏数据安全回退", () => {
  const project = createProjectRecord(projectDraft(), []);
  const evaluation = createEvaluationRecord({ ...draft(), projectId: project.id }, [], [project]);
  const storage = memoryStorage();
  saveEvaluationStore([evaluation], storage);
  const loaded = loadEvaluationStore(storage);
  assert.equal(loaded.evaluations[0].id, evaluation.id);
  assert.equal(loaded.evaluations[0].numericValue, 92.3);
  assert.equal(loaded.error, null);

  assert.deepEqual(loadEvaluationStore(memoryStorage()).evaluations, []);
  const broken = loadEvaluationStore(memoryStorage("{bad"));
  assert.deepEqual(broken.evaluations, []);
  assert.ok(broken.error);
});

test("createEvaluationInputDate 返回本地日期输入格式", () => {
  const date = createEvaluationInputDate(new Date("2026-08-03T15:30:00+08:00"));
  assert.equal(date, "2026-08-03");
});
