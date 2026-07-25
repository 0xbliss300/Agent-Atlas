import test from "node:test";
import assert from "node:assert/strict";
import { createGuideHeadingIdAllocator, getGuideSections, slugifyGuideHeading } from "./guide.js";

test("中文、英文和标点会转换为稳定指南标题 ID", () => {
  assert.equal(slugifyGuideHeading("  快速开始  "), "guide-快速开始");
  assert.equal(slugifyGuideHeading("Codex 项目上下文"), "guide-codex-项目上下文");
  assert.equal(slugifyGuideHeading("***"), "guide-section");
});

test("重复标题会获得稳定且不冲突的 ID", () => {
  const nextId = createGuideHeadingIdAllocator();
  assert.equal(nextId("常见问题"), "guide-常见问题");
  assert.equal(nextId("常见问题"), "guide-常见问题-2");
});

test("目录只提取二级标题并与正文标题 ID 保持一致", () => {
  const markdown = [
    "# 指南",
    "## 快速开始",
    "### 第一步",
    "## 快速开始",
    "## 本地数据与安全边界",
  ].join("\n");
  assert.deepEqual(getGuideSections(markdown), [
    { id: "guide-快速开始", title: "快速开始" },
    { id: "guide-快速开始-2", title: "快速开始" },
    { id: "guide-本地数据与安全边界", title: "本地数据与安全边界" },
  ]);
});
