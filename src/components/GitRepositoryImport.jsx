import { useState } from "react";
import { ArrowsClockwise, GithubLogo, ShieldCheck } from "@phosphor-icons/react";
import { importGitRepository } from "../data/gitRepositoryImport.js";

export function GitRepositoryImport({ existingProjects, onImported, fetchImpl }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("请输入 Git 仓库 URL。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await importGitRepository(trimmed, existingProjects, { fetchImpl });
      setUrl("");
      onImported(result);
    } catch (fetchError) {
      setError(fetchError.message || "无法读取仓库元数据。");
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleFetch();
    }
  };

  return (
    <section className="project-import-source" aria-labelledby="git-import-title">
      <div className="project-import-heading">
        <div>
          <p className="eyebrow">GIT REPOSITORY IMPORT</p>
          <h3 id="git-import-title">从 Git 仓库导入</h3>
        </div>
        <span>输入公开仓库 URL</span>
      </div>
      <div className="local-safety">
        <ShieldCheck size={23} weight="duotone" />
        <p>
          仅在你点击拉取时访问 GitHub 公开
          API，不保存凭证、不克隆仓库、不持久化远程句柄；私有仓库会被拒绝。
        </p>
      </div>
      <div style={{ marginTop: 14 }}>
        <label className="form-field" htmlFor="git-repository-url">
          <span>仓库 URL</span>
          <input
            id="git-repository-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="https://github.com/owner/repo"
            aria-invalid={Boolean(error)}
          />
        </label>
      </div>
      <div style={{ marginTop: 10 }}>
        <button
          className="secondary-button"
          type="button"
          onClick={handleFetch}
          disabled={busy || !url.trim()}
        >
          <GithubLogo size={17} />
          拉取仓库元数据
        </button>
      </div>
      {busy && (
        <p className="sync-loading" role="status">
          <ArrowsClockwise size={18} />
          正在只读拉取 GitHub 仓库元数据…
        </p>
      )}
      {error && (
        <p className="form-submit-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
