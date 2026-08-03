import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeGitRepositoryMetadata,
  fetchGitRepositoryMetadata,
  importGitRepository,
  parseGitRepositoryUrl,
} from "./gitRepositoryImport.js";
import { IMPORT_FIELD_STATUS } from "./projectImport.js";

test("parseGitRepositoryUrl 解析 HTTPS、git+、SSH 简写与 ssh:// 形式", () => {
  const cases = [
    ["https://github.com/owner/repo", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo/tree/main", { owner: "owner", repo: "repo" }],
    ["git+https://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["git://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["git@github.com:owner/repo.git", { owner: "owner", repo: "repo" }],
    ["ssh://git@github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["https://www.github.com/Owner/Repo", { owner: "Owner", repo: "Repo" }],
  ];
  for (const [input, expected] of cases) {
    const parsed = parseGitRepositoryUrl(input);
    assert.equal(parsed.owner, expected.owner);
    assert.equal(parsed.repo, expected.repo);
    assert.equal(parsed.host, "github.com");
    assert.equal(parsed.url, `https://github.com/${expected.owner}/${expected.repo}`);
  }
});

test("parseGitRepositoryUrl 拒绝非 github 主机、无效 URL 与缺少路径", () => {
  const invalid = [
    "https://gitlab.com/owner/repo",
    "not a url",
    "https://github.com/onlyowner",
    "",
    "ftp://github.com/owner/repo",
  ];
  for (const input of invalid) {
    assert.throws(() => parseGitRepositoryUrl(input), Error);
  }
});

test("analyzeGitRepositoryMetadata 合并 README 与 package.json，字段优先级 package.json > README > 仓库元数据", () => {
  const result = analyzeGitRepositoryMetadata({
    url: "https://github.com/owner/demo-agent",
    owner: "owner",
    repo: "demo-agent",
    repository: {
      name: "demo-agent",
      description: "仓库描述",
      language: "JavaScript",
      default_branch: "main",
      pushed_at: "2026-07-01T00:00:00Z",
      license: { spdx_id: "MIT" },
    },
    readme: {
      name: "README.md",
      text: "# Demo Agent\n\nREADME 描述\n\n- [ ] 完成测试",
    },
    packageJson: {
      name: "package.json",
      text: JSON.stringify({
        name: "demo-agent-pkg",
        description: "package.json 描述",
        dependencies: { react: "19.0.0" },
        devDependencies: { typescript: "5.0.0" },
        scripts: { dev: "vite" },
      }),
    },
    latestCommit: {
      sha: "abcdef1234567890",
      commit: { author: { date: "2026-07-15T00:00:00Z" }, message: "fix" },
    },
    fetchedAt: new Date("2026-08-01T00:00:00Z"),
  });

  assert.equal(result.sourceType, "git-repository");
  assert.equal(result.sourceName, "owner/demo-agent");
  assert.equal(result.project.name, "demo-agent-pkg");
  assert.equal(result.project.short, "package.json 描述");
  assert.equal(result.project.description, "package.json 描述");
  assert.equal(result.project.repositoryUrl, "https://github.com/owner/demo-agent");
  assert.deepEqual(result.project.nextTasks, [
    { id: result.project.nextTasks[0].id, title: "完成测试", done: false },
  ]);
  assert.ok(result.project.technology.languages.includes("TypeScript"));
  assert.ok(result.project.technology.frameworks.includes("react"));
  assert.equal(result.project.technology.runCommand, "npm run dev");
  assert.equal(result.git.branch, "main");
  assert.equal(result.git.commit, "abcdef123456");
  assert.equal(result.git.updatedAt, "2026-07-15T00:00:00Z");
  assert.equal(result.project.updatedAt, "2026-07-15T00:00:00Z");
  assert.ok(result.notes.some((note) => note.includes("MIT")));
  assert.ok(result.filesRead.includes("README.md"));
  assert.ok(result.filesRead.includes("package.json"));
});

test("analyzeGitRepositoryMetadata 空仓库仅有元数据时仍返回最小结果", () => {
  const result = analyzeGitRepositoryMetadata({
    url: "https://github.com/owner/empty",
    owner: "owner",
    repo: "empty",
    repository: {
      description: "空仓库",
      language: "Python",
      default_branch: "main",
    },
    readme: null,
    packageJson: null,
    latestCommit: null,
    fetchedAt: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(result.project.short, "空仓库");
  assert.deepEqual(result.project.technology.languages, ["Python"]);
  assert.equal(result.git, null);
  assert.equal(result.project.repositoryUrl, "https://github.com/owner/empty");
  assert.ok(result.filesRead.includes("repository metadata"));
});

test("analyzeGitRepositoryMetadata README 覆盖仓库元数据描述但被 package.json 覆盖", () => {
  const result = analyzeGitRepositoryMetadata({
    url: "https://github.com/o/r",
    owner: "o",
    repo: "r",
    repository: { description: "repo desc" },
    readme: { name: "README.md", text: "# Title\n\nreadme desc" },
    packageJson: {
      name: "package.json",
      text: JSON.stringify({ description: "pkg desc" }),
    },
    fetchedAt: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(result.project.name, "Title");
  assert.equal(result.project.short, "pkg desc");
  assert.equal(result.project.description, "pkg desc");
});

function mockResponse(status, body) {
  return {
    status,
    headers: { get: () => null },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

test("fetchGitRepositoryMetadata 成功拉取 README、package.json 与最近提交", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith("/repos/owner/repo")) {
      return mockResponse(200, {
        name: "repo",
        description: "demo",
        language: "TypeScript",
        default_branch: "main",
        license: { spdx_id: "MIT" },
      });
    }
    if (url.endsWith("/repos/owner/repo/readme")) {
      return mockResponse(200, "# Demo\n\nreadme");
    }
    if (url.endsWith("/repos/owner/repo/contents/package.json")) {
      return mockResponse(200, JSON.stringify({ name: "demo", dependencies: {} }));
    }
    if (url.endsWith("/repos/owner/repo/commits?per_page=1")) {
      return mockResponse(200, [
        { sha: "abc123", commit: { author: { date: "2026-07-01T00:00:00Z" } } },
      ]);
    }
    return mockResponse(404, "");
  };

  const metadata = await fetchGitRepositoryMetadata(
    { owner: "owner", repo: "repo", url: "https://github.com/owner/repo" },
    { fetchImpl },
  );
  assert.equal(metadata.repository.description, "demo");
  assert.equal(metadata.readme.text, "# Demo\n\nreadme");
  assert.ok(metadata.packageJson.text.includes("demo"));
  assert.equal(metadata.latestCommit.sha, "abc123");
  assert.equal(calls.length, 4);
});

test("fetchGitRepositoryMetadata 仓库不存在时抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(404, "");
  await assert.rejects(
    fetchGitRepositoryMetadata(
      { owner: "owner", repo: "missing", url: "https://github.com/owner/missing" },
      { fetchImpl },
    ),
    /未找到仓库 owner\/missing，或仓库为私有/,
  );
});

test("fetchGitRepositoryMetadata 速率限制时抛出友好错误", async () => {
  const fetchImpl = async () => mockResponse(403, "");
  await assert.rejects(
    fetchGitRepositoryMetadata(
      { owner: "owner", repo: "repo", url: "https://github.com/owner/repo" },
      { fetchImpl },
    ),
    /GitHub API 速率限制/,
  );
});

test("fetchGitRepositoryMetadata README 与 package.json 缺失时不阻断导入", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/repos/owner/repo")) {
      return mockResponse(200, { description: "demo", default_branch: "main" });
    }
    return mockResponse(404, "");
  };
  const metadata = await fetchGitRepositoryMetadata(
    { owner: "owner", repo: "repo", url: "https://github.com/owner/repo" },
    { fetchImpl },
  );
  assert.equal(metadata.repository.description, "demo");
  assert.equal(metadata.readme, null);
  assert.equal(metadata.packageJson, null);
  assert.equal(metadata.latestCommit, null);
});

test("fetchGitRepositoryMetadata 网络错误时抛出友好错误", async () => {
  const fetchImpl = async () => {
    throw new TypeError("network failed");
  };
  await assert.rejects(
    fetchGitRepositoryMetadata(
      { owner: "owner", repo: "repo", url: "https://github.com/owner/repo" },
      { fetchImpl },
    ),
    /无法读取仓库元数据/,
  );
});

test("importGitRepository 端到端生成草稿并填充 repositoryUrl", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/repos/owner/demo")) {
      return mockResponse(200, {
        description: "demo agent",
        language: "TypeScript",
        default_branch: "main",
        license: { spdx_id: "MIT" },
      });
    }
    if (url.endsWith("/repos/owner/demo/readme")) {
      return mockResponse(200, "# Demo Agent\n\nA demo.");
    }
    if (url.endsWith("/repos/owner/demo/contents/package.json")) {
      return mockResponse(200, JSON.stringify({ name: "demo", dependencies: { react: "19.0.0" } }));
    }
    if (url.endsWith("/repos/owner/demo/commits?per_page=1")) {
      return mockResponse(200, [
        { sha: "abcdef123456", commit: { author: { date: "2026-07-01T00:00:00Z" } } },
      ]);
    }
    return mockResponse(404, "");
  };

  const imported = await importGitRepository("https://github.com/owner/demo.git", [], {
    fetchImpl,
    now: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(imported.draft.name, "Demo Agent");
  assert.equal(imported.draft.repositoryUrl, "https://github.com/owner/demo");
  assert.equal(imported.draft.logText, "从 Git 仓库导入：owner/demo");
  assert.equal(imported.fieldStatus.repositoryUrl, IMPORT_FIELD_STATUS.DETECTED);
  assert.equal(imported.sourceMetadata.sourceType, "git-repository");
  assert.equal(imported.sourceMetadata.branch, "main");
  assert.equal(imported.sourceMetadata.commit, "abcdef123456");
  assert.ok(imported.sourceMetadata.filesRead.includes("README.md"));
});

test("importGitRepository URL 无效时抛出解析错误", async () => {
  await assert.rejects(
    importGitRepository("https://gitlab.com/owner/repo", [], { fetchImpl: async () => {} }),
    /仅支持 github\.com/,
  );
});

test("importGitRepository 同名项目时标记 duplicateName", async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith("/repos/owner/demo")) {
      return mockResponse(200, { description: "demo", default_branch: "main" });
    }
    return mockResponse(404, "");
  };
  const imported = await importGitRepository("https://github.com/owner/demo", [{ name: "demo" }], {
    fetchImpl,
    now: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(imported.duplicateName, true);
});
