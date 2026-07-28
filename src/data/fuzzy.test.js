import test from "node:test";
import assert from "node:assert/strict";
import { fuzzyFilter, fuzzyMatch } from "./fuzzy.js";

test("空查询视为全部命中", () => {
  assert.deepEqual(fuzzyMatch("", "任意文本"), { matched: true, score: 0 });
  assert.deepEqual(fuzzyFilter(["a", "b"], ""), ["a", "b"]);
});

test("完整子串命中且分数高于子序列命中", () => {
  const exact = fuzzyMatch("向量", "向量数据库");
  const subseq = fuzzyMatch("向库", "向量数据库");
  assert.equal(exact.matched, true);
  assert.equal(subseq.matched, true);
  assert.ok(exact.score > subseq.score, "子串分数应高于子序列");
});

test("不匹配时返回未命中", () => {
  assert.equal(fuzzyMatch("xyz", "研究笔记").matched, false);
});

test("中文子序列按顺序匹配", () => {
  assert.equal(fuzzyMatch("研笔", "研究笔记").matched, true);
  assert.equal(fuzzyMatch("笔研", "研究笔记").matched, false);
});

test("fuzzyFilter 按命中分数降序稳定排序", () => {
  const items = ["向量数据库", "检索向量", "模型评估"];
  const results = fuzzyFilter(items, "向量", (item) => item);
  assert.deepEqual(results, ["向量数据库", "检索向量"]);
});

test("fuzzyFilter 空查询保留原顺序", () => {
  const items = [{ name: "B" }, { name: "A" }];
  const results = fuzzyFilter(items, "", (item) => item.name);
  assert.deepEqual(results, items);
});

test("大小写与首尾空格不影响匹配", () => {
  assert.equal(fuzzyMatch("  React ", "react framework").matched, true);
});

test("fuzzyFilter getText 缺省按字符串匹配", () => {
  const results = fuzzyFilter(["alpha", "beta", "alphabet"], "alp");
  assert.deepEqual(results, ["alpha", "alphabet"]);
});
