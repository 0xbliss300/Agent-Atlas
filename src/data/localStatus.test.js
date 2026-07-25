import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLocalDirectory,
  analyzeLocalStatusText,
  MAX_LOCAL_FILE_BYTES,
  readLocalStatusFile,
} from "./localStatus.js";

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
    async getFileHandle(key) {
      const entry = entries[key];
      if (!entry || entry.getFileHandle) throw missingError();
      return entry;
    },
    async getDirectoryHandle(key) {
      const entry = entries[key];
      if (!entry?.getFileHandle) throw missingError();
      return entry;
    },
  };
}

test("Markdown 状态读取会计算勾选进度、任务、阻塞项和里程碑", () => {
  const result = analyzeLocalStatusText({
    name: "PROJECT_TODO.md",
    text: [
      "当前里程碑：完成本地读取",
      "- [x] 完成解析器",
      "- [ ] 补充交互",
      "- [x] 增加测试",
      "## 当前阻塞",
      "- 等待目录授权",
    ].join("\n"),
  });
  assert.equal(result.project.progress, 67);
  assert.equal(result.project.nextTasks.length, 3);
  assert.equal(result.project.blockers[0].title, "等待目录授权");
  assert.equal(result.project.milestone, "完成本地读取");
});

test("JSON 状态读取支持结构化状态、任务与技术信息", () => {
  const result = analyzeLocalStatusText({
    name: "project-status.json",
    text: JSON.stringify({
      status: "active",
      progress: 55,
      milestone: "完成同步闭环",
      blockers: ["等待模型评估"],
      tasks: [{ title: "补充回退逻辑", done: false }],
      technology: {
        languages: ["TypeScript"],
        frameworks: ["React"],
        runCommand: "npm run dev",
      },
    }),
  });
  assert.equal(result.project.status, "active");
  assert.equal(result.project.progress, 55);
  assert.equal(result.project.nextTasks[0].title, "补充回退逻辑");
  assert.deepEqual(result.project.technology.frameworks, ["React"]);
});

test("package.json 状态读取会提取语言、框架、模型、数据依赖和启动命令", () => {
  const result = analyzeLocalStatusText({
    name: "package.json",
    text: JSON.stringify({
      name: "local-agent",
      description: "本地 Agent 开发工具",
      scripts: { dev: "vite" },
      dependencies: {
        react: "19.0.0",
        openai: "5.0.0",
        "better-sqlite3": "12.0.0",
      },
      devDependencies: { vite: "6.0.0", typescript: "5.0.0" },
    }),
  });
  assert.deepEqual(result.project.technology.languages, ["TypeScript"]);
  assert.deepEqual(result.project.technology.frameworks, ["react", "vite"]);
  assert.deepEqual(result.project.technology.models, ["openai"]);
  assert.deepEqual(result.project.technology.dataSources, ["better-sqlite3"]);
  assert.equal(result.project.technology.runCommand, "npm run dev");
  assert.equal(result.project.name, "local-agent");
  assert.equal(result.project.short, "本地 Agent 开发工具");
});

test("README 会提取标题和首段简介", () => {
  const result = analyzeLocalStatusText({
    name: "README.md",
    text: "# 研究 Agent\n\n帮助开发者整理研究笔记。\n\n## 安装\nnpm install",
  });
  assert.equal(result.project.name, "研究 Agent");
  assert.equal(result.project.short, "帮助开发者整理研究笔记。");
});

test("目录读取会合并 TODO、package.json 与 Git 分支提交信息", async () => {
  const git = directoryHandle(".git", {
    HEAD: fileHandle("HEAD", "ref: refs/heads/main\n"),
    refs: directoryHandle("refs", {
      heads: directoryHandle("heads", {
        main: fileHandle("main", "0123456789abcdef\n"),
      }),
    }),
    logs: directoryHandle("logs", {
      HEAD: fileHandle(
        "HEAD",
        "0000000 0123456 User <user@example.com> 1720000000 +0800\tcommit: local",
      ),
    }),
  });
  const directory = directoryHandle("demo-agent", {
    "PROJECT_TODO.md": fileHandle("PROJECT_TODO.md", "- [x] 已完成\n- [ ] 待完成"),
    "package.json": fileHandle(
      "package.json",
      JSON.stringify({ scripts: { dev: "vite" }, dependencies: { react: "19.0.0" } }),
    ),
    "status.json": fileHandle(
      "status.json",
      JSON.stringify({ technology: { models: ["local-model"] } }),
    ),
    ".git": git,
  });
  const result = await analyzeLocalDirectory(directory);
  assert.equal(result.sourceType, "directory");
  assert.equal(result.project.progress, 50);
  assert.equal(result.project.technology.frameworks[0], "react");
  assert.equal(result.project.technology.models[0], "local-model");
  assert.equal(result.git.branch, "main");
  assert.equal(result.git.commit, "0123456789ab");
});

test("目录字段冲突优先使用状态 JSON，其次 package.json 和 README", async () => {
  const directory = directoryHandle("directory-name", {
    "README.md": fileHandle("README.md", "# README 名称\n\nREADME 简介"),
    "package.json": fileHandle(
      "package.json",
      JSON.stringify({ name: "package-name", description: "package 简介" }),
    ),
    "project-status.json": fileHandle(
      "project-status.json",
      JSON.stringify({
        name: "status-name",
        short: "状态简介",
        technology: { languages: ["TypeScript"], frameworks: ["React"] },
      }),
    ),
  });
  const result = await analyzeLocalDirectory(directory);
  assert.equal(result.project.name, "status-name");
  assert.equal(result.project.short, "状态简介");
  assert.deepEqual(result.project.technology.languages, ["TypeScript"]);
  assert.deepEqual(result.project.technology.frameworks, ["React"]);
});

test("单个本地文件超过上限时拒绝读取", async () => {
  await assert.rejects(
    () =>
      readLocalStatusFile({
        name: "status.json",
        size: MAX_LOCAL_FILE_BYTES + 1,
        lastModified: Date.now(),
        async text() {
          return "{}";
        },
      }),
    /超过单文件/,
  );
});
