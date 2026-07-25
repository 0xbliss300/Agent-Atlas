import test from "node:test";
import assert from "node:assert/strict";
import { getPageTitle, normalizeRoutePath, parseRoute } from "./routing.js";

test("Hash、前后斜杠和直接路径会规范成稳定本地路由", () => {
  assert.equal(normalizeRoutePath("#/project/abc/"), "/project/abc");
  assert.equal(normalizeRoutePath("notes"), "/notes");
});

test("识别概览、工作台、使用指南、研究笔记文档、项目详情和项目笔记", () => {
  assert.equal(parseRoute("/").type, "overview");
  assert.deepEqual(parseRoute("#/workbench"), {
    type: "workbench",
    path: "/workbench",
  });
  assert.deepEqual(parseRoute("#/guide"), {
    type: "guide",
    path: "/guide",
  });
  assert.equal(parseRoute("#/notes").type, "notes");
  assert.equal(parseRoute("#/notes/new").type, "note-new");
  assert.deepEqual(parseRoute("#/notes/new/project/a%20b"), {
    type: "note-new",
    path: "/notes/new/project/a%20b",
    preferredProjectId: "a b",
  });
  assert.deepEqual(parseRoute("#/notes/note%201"), {
    type: "note",
    path: "/notes/note%201",
    noteId: "note 1",
  });
  assert.deepEqual(parseRoute("#/project/a%20b"), {
    type: "project",
    path: "/project/a%20b",
    projectId: "a b",
  });
  assert.equal(parseRoute("#/project/abc/notes").type, "project-notes");
});

test("未知地址和畸形项目 ID 返回 not-found", () => {
  assert.equal(parseRoute("#/missing").type, "not-found");
  assert.equal(parseRoute("#/project/%E0%A4%A").type, "not-found");
});

test("页面标题跟随路由与项目变化", () => {
  assert.match(getPageTitle(parseRoute("/")), /个人 Agent/);
  assert.match(getPageTitle(parseRoute("/workbench")), /开发工作台/);
  assert.match(getPageTitle(parseRoute("/guide")), /项目使用指南/);
  assert.match(getPageTitle(parseRoute("/project/abc"), { name: "知识库 Agent" }), /知识库 Agent/);
  assert.match(getPageTitle(parseRoute("/notes/note-1"), null, { title: "检索实验" }), /检索实验/);
  assert.match(getPageTitle(parseRoute("/missing")), /页面不存在/);
});
