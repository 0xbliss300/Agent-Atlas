import { useRef, useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  FileText,
  FolderOpen,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import {
  buildBatchDrafts,
  MAX_BATCH_DIRECTORIES,
  MAX_BATCH_TOTAL_BYTES,
  parseBatchCsvText,
  parseBatchJsonText,
  scanParentDirectory,
} from "../data/batchImport.js";
import { IMPORT_FIELD_STATUS } from "../data/projectImport.js";
import { PROJECT_STATUS_META } from "../data/projects.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

const FIELD_LABELS = {
  name: "名称",
  short: "简介",
  description: "完整介绍",
  status: "状态",
  progress: "完成度",
  milestone: "里程碑",
  repositoryUrl: "GitHub 地址",
  blockersText: "阻塞问题",
  nextTasksText: "下一步任务",
  languagesText: "语言",
  frameworksText: "框架",
  modelsText: "模型",
  dataSourcesText: "数据源",
  runCommand: "启动命令",
};

function summarizeFieldStatus(fieldStatus) {
  const grouped = { detected: [], confirm: [], missing: [] };
  Object.entries(fieldStatus).forEach(([name, state]) => {
    if (grouped[state]) grouped[state].push(name);
  });
  const names = (items) => items.map((name) => FIELD_LABELS[name] ?? name).join("、");
  return {
    detected: names(grouped.detected),
    confirm: names(grouped.confirm),
    missing: names(grouped.missing),
  };
}

export function BatchImportPanel({ existingProjects, onClose, onSaveBatch, pickDirectory }) {
  const [phase, setPhase] = useState("entry");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [scanErrors, setScanErrors] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [expandedKey, setExpandedKey] = useState(null);
  const [result, setResult] = useState(null);
  const panelRef = useRef(null);
  const firstButtonRef = useRef(null);
  const fileCsvRef = useRef(null);
  const fileJsonRef = useRef(null);

  const requestClose = () => {
    onClose();
  };
  useDialogFocus(panelRef, firstButtonRef, requestClose);

  const handleScanDirectory = async () => {
    const picker = pickDirectory ?? window.showDirectoryPicker;
    if (!picker) {
      setError("当前浏览器不支持目录读取，请改用 CSV 或 JSON 批量导入。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const handle = await picker({ mode: "read" });
      const { results, errors } = await scanParentDirectory(handle, existingProjects);
      if (!results.length && errors.length) {
        throw new Error(errors[0].message || "所选父目录下没有可读取的子项目目录。");
      }
      setDrafts(results);
      setScanErrors(errors);
      setSelectedKeys(new Set(results.map((item) => item.key)));
      setPhase("review");
    } catch (scanError) {
      if (scanError?.name !== "AbortError") {
        setError(scanError.message || "无法批量扫描所选目录。");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (event, parser, sourceType) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const text = await file.text();
      const { records, sourceName } = parser(text, file.name);
      const { items, errors } = buildBatchDrafts(records, existingProjects, {
        sourceType,
        sourceName,
      });
      if (!items.length && errors.length) {
        throw new Error(errors[0].message || "文件中没有可识别的项目记录。");
      }
      setDrafts(items);
      setScanErrors(errors);
      setSelectedKeys(new Set(items.map((item) => item.key)));
      setPhase("review");
    } catch (parseError) {
      setError(parseError.message || "无法解析所选文件。");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelect = (key) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(drafts.map((item) => item.key)));
  const clearAll = () => setSelectedKeys(new Set());

  const applySuggestedName = (key, suggestedName) => {
    setDrafts((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              draft: { ...item.draft, name: suggestedName },
              duplicateName: false,
              fieldStatus: { ...item.fieldStatus, name: IMPORT_FIELD_STATUS.CONFIRM },
            }
          : item,
      ),
    );
  };

  const handleCreate = () => {
    const outcome = onSaveBatch(drafts, [...selectedKeys], existingProjects);
    setResult(outcome);
    setPhase("result");
  };

  const resetToEntry = () => {
    setDrafts([]);
    setScanErrors([]);
    setSelectedKeys(new Set());
    setResult(null);
    setError("");
    setExpandedKey(null);
    setPhase("entry");
  };

  const selectedCount = selectedKeys.size;
  const duplicateCount = drafts.filter((item) => item.duplicateName).length;

  return (
    <div className="scrim" onMouseDown={requestClose} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="create-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="create-head">
          <div>
            <p className="eyebrow">BATCH IMPORT</p>
            <h2 id="batch-import-title">批量导入项目</h2>
            <p>一次扫描多个子项目目录，或上传 CSV/JSON 批量创建草稿。</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={requestClose}
            aria-label="关闭批量导入"
          >
            <X size={20} />
          </button>
        </div>

        {phase === "entry" && (
          <section className="project-import-source" aria-labelledby="batch-entry-title">
            <div className="project-import-heading">
              <div>
                <p className="eyebrow">LOCAL READ-ONLY BATCH</p>
                <h3 id="batch-entry-title">选择批量来源</h3>
              </div>
              <span>也可在添加项目时使用单目录导入</span>
            </div>
            <div className="local-safety">
              <ShieldCheck size={23} weight="duotone" />
              <p>
                只读取你明确选择的父目录下的子目录，或你上传的 CSV/JSON
                文件；不扫描未选路径，单次总读取量受限。
              </p>
            </div>
            <div className="sync-source-grid">
              <button
                ref={firstButtonRef}
                className="sync-source"
                type="button"
                onClick={handleScanDirectory}
                disabled={busy}
              >
                <FolderOpen size={27} weight="duotone" />
                <strong>选择父目录批量扫描</strong>
                <span>只读每个子目录的 README、状态 JSON、package.json 与 Git 元数据</span>
              </button>
              <button
                className="sync-source"
                type="button"
                onClick={() => fileCsvRef.current?.click()}
                disabled={busy}
              >
                <FileText size={27} weight="duotone" />
                <strong>上传 CSV 批量文件</strong>
                <span>表头：name, short, status, progress, milestone 等</span>
              </button>
              <button
                className="sync-source"
                type="button"
                onClick={() => fileJsonRef.current?.click()}
                disabled={busy}
              >
                <FileText size={27} weight="duotone" />
                <strong>上传 JSON 批量文件</strong>
                <span>对象数组或包含 projects 数组</span>
              </button>
            </div>
            <input
              ref={fileCsvRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFile(event, parseBatchCsvText, "csv")}
            />
            <input
              ref={fileJsonRef}
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={(event) => handleFile(event, parseBatchJsonText, "json")}
            />
            <small className="import-limits">
              最多 {MAX_BATCH_DIRECTORIES} 个子目录，批量读取总量上限{" "}
              {MAX_BATCH_TOTAL_BYTES / 1024 / 1024} MB；CSV/JSON 最多 100 条记录。
            </small>
            {busy && (
              <p className="sync-loading" role="status">
                <ArrowsClockwise size={18} />
                正在只读批量分析本地内容…
              </p>
            )}
            {error && (
              <p className="form-submit-error" role="alert">
                {error}
              </p>
            )}
          </section>
        )}

        {phase === "review" && (
          <section aria-labelledby="batch-review-title">
            <div className="import-preview-head" style={{ marginBottom: 16 }}>
              <div>
                <p className="eyebrow">REVIEW DRAFTS</p>
                <h3 id="batch-review-title">
                  已生成 {drafts.length} 个草稿，已选 {selectedCount} 个
                </h3>
              </div>
              <strong>{duplicateCount > 0 ? `${duplicateCount} 个同名警告` : "无同名冲突"}</strong>
            </div>

            {scanErrors.length > 0 && (
              <div className="import-preview" style={{ marginBottom: 16 }}>
                <p className="import-duplicate" role="alert">
                  {scanErrors.length} 个来源读取失败（已跳过）：
                </p>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--muted)" }}>
                  {scanErrors.map((entry, index) => (
                    <li key={`err-${index}`}>
                      {entry.sourceName}：{entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <button
                type="button"
                className="secondary-button"
                onClick={selectAll}
                disabled={selectedCount === drafts.length}
              >
                全选
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={clearAll}
                disabled={selectedCount === 0}
              >
                清除选择
              </button>
            </div>

            <div style={{ display: "grid", gap: 12, maxHeight: "48vh", overflowY: "auto" }}>
              {drafts.map((item) => {
                const summary = summarizeFieldStatus(item.fieldStatus);
                const isExpanded = expandedKey === item.key;
                const isSelected = selectedKeys.has(item.key);
                const statusMeta =
                  PROJECT_STATUS_META[item.draft.status] ?? PROJECT_STATUS_META.planning;
                return (
                  <div key={item.key} className="import-preview">
                    <div className="import-preview-head">
                      <label className="pin-project-setting">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.key)}
                        />
                        <span>
                          <strong>{item.draft.name || "未命名项目"}</strong>
                          <small>
                            {item.draft.short || "无简介"} · {statusMeta.label} ·{" "}
                            {item.draft.progress}%
                          </small>
                        </span>
                      </label>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setExpandedKey(isExpanded ? null : item.key)}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? "收起" : "预览"}
                      </button>
                    </div>
                    {item.duplicateName && (
                      <p className="import-duplicate" role="alert">
                        已有同名项目。建议改为“{item.suggestedName}”。
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ marginLeft: 8 }}
                          onClick={() => applySuggestedName(item.key, item.suggestedName)}
                        >
                          应用建议
                        </button>
                      </p>
                    )}
                    {isExpanded && (
                      <dl className="import-status-summary">
                        <div>
                          <dt>已检测</dt>
                          <dd>{summary.detected || "无"}</dd>
                        </div>
                        <div>
                          <dt>需确认</dt>
                          <dd>{summary.confirm || "无"}</dd>
                        </div>
                        <div>
                          <dt>未检测到</dt>
                          <dd>{summary.missing || "无"}</dd>
                        </div>
                      </dl>
                    )}
                    {item.sourceMetadata?.branch && (
                      <p className="previous-sync">
                        {item.sourceMetadata.branch} · {item.sourceMetadata.commit || "提交未知"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {error && (
              <p className="form-submit-error" role="alert" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="button" className="secondary-button" onClick={resetToEntry}>
                重新选择来源
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleCreate}
                disabled={selectedCount === 0}
              >
                <CheckCircle size={18} weight="bold" />
                批量创建 {selectedCount > 0 ? `（${selectedCount}）` : ""}
              </button>
            </div>
          </section>
        )}

        {phase === "result" && (
          <section aria-labelledby="batch-result-title">
            <div className="import-preview-head" style={{ marginBottom: 16 }}>
              <div>
                <p className="eyebrow">BATCH RESULT</p>
                <h3 id="batch-result-title">
                  成功创建 {result?.created.length ?? 0} 个项目
                  {result?.failed.length ? `，${result.failed.length} 个失败` : ""}
                </h3>
              </div>
              <strong>{result?.failed.length ? `${result.failed.length} 失败` : "全部成功"}</strong>
            </div>

            {result?.failed.length > 0 && (
              <div className="import-preview" style={{ marginBottom: 16 }}>
                <p className="import-duplicate" role="alert">
                  以下草稿创建失败（已跳过，不影响已成功项）：
                </p>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--muted)" }}>
                  {result.failed.map((entry, index) => (
                    <li key={`fail-${index}`}>
                      {entry.sourceName}：{entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={resetToEntry}>
                继续批量导入
              </button>
              <button type="button" className="primary-button" onClick={requestClose}>
                完成
              </button>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
