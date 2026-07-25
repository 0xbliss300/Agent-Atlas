import { useRef, useState } from "react";
import { ArrowsClockwise, FileText, FolderOpen, ShieldCheck } from "@phosphor-icons/react";
import {
  analyzeLocalDirectory,
  MAX_LOCAL_FILE_BYTES,
  MAX_LOCAL_TOTAL_BYTES,
  readLocalStatusFile,
} from "../data/localStatus.js";
import { createProjectImportDraft } from "../data/projectImport.js";

export function ProjectImportSource({ existingProjects, onImported }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const finishImport = (result) => {
    onImported(createProjectImportDraft(result, existingProjects));
  };

  const inspectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      finishImport(await readLocalStatusFile(file));
    } catch (inspectError) {
      setError(inspectError.message || "无法读取所选状态文件。");
    } finally {
      setBusy(false);
    }
  };

  const inspectDirectory = async () => {
    if (!window.showDirectoryPicker) {
      setError("当前浏览器不支持目录读取，请改用 JSON、Markdown 或 package.json 文件。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const directory = await window.showDirectoryPicker({ mode: "read" });
      finishImport(await analyzeLocalDirectory(directory));
    } catch (inspectError) {
      if (inspectError?.name !== "AbortError") {
        setError(inspectError.message || "无法读取所选目录。");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="project-import-source" aria-labelledby="project-import-title">
      <div className="project-import-heading">
        <div>
          <p className="eyebrow">LOCAL READ-ONLY IMPORT</p>
          <h3 id="project-import-title">从本地项目开始</h3>
        </div>
        <span>也可以直接填写下方表单</span>
      </div>
      <div className="local-safety">
        <ShieldCheck size={23} weight="duotone" />
        <p>
          只读取你明确选择的目录或文件，不上传、不写入、不保存目录权限，也不会自动填入绝对路径。
        </p>
      </div>
      <div className="sync-source-grid">
        <button className="sync-source" type="button" onClick={inspectDirectory} disabled={busy}>
          <FolderOpen size={27} weight="duotone" />
          <strong>选择项目目录</strong>
          <span>只读 README、TODO、状态 JSON、package.json 与 Git 元数据</span>
        </button>
        <button
          className="sync-source"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <FileText size={27} weight="duotone" />
          <strong>选择单个文件</strong>
          <span>目录不可用时，使用 JSON、Markdown 或 package.json</span>
        </button>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept=".json,.md,.markdown,application/json,text/markdown"
          onChange={inspectFile}
        />
      </div>
      <small className="import-limits">
        单文件上限 {MAX_LOCAL_FILE_BYTES / 1024 / 1024} MB，本次读取总量上限{" "}
        {MAX_LOCAL_TOTAL_BYTES / 1024 / 1024} MB。
      </small>
      {busy && (
        <p className="sync-loading" role="status">
          <ArrowsClockwise size={18} />
          正在只读分析本地内容…
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
