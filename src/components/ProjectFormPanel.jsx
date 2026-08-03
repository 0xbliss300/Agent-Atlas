import { useMemo, useRef, useState } from "react";
import { GitBranch, PencilSimple, Plus, Stack, X } from "@phosphor-icons/react";
import {
  EMPTY_PROJECT_DRAFT,
  projectToDraft,
  PROJECT_STATUSES,
  validateProjectDraft,
} from "../data/projects.js";
import { IMPORT_FIELD_STATUS } from "../data/projectImport.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { useConfirmDialog } from "./ConfirmDialog.jsx";
import { GitRepositoryImport } from "./GitRepositoryImport.jsx";
import { ProjectImportSource } from "./ProjectImportSource.jsx";
import { TemplateWorkspace } from "./TemplateWorkspace.jsx";

const IMPORT_STATUS_LABELS = {
  [IMPORT_FIELD_STATUS.DETECTED]: "已检测",
  [IMPORT_FIELD_STATUS.CONFIRM]: "需确认",
  [IMPORT_FIELD_STATUS.MISSING]: "未检测到",
};

function FormField({ label, name, error, hint, children, required = false, importStatus }) {
  return (
    <label className={"form-field " + (error ? "has-error" : "")}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
        {importStatus && (
          <em className={`import-field-status is-${importStatus}`}>
            {IMPORT_STATUS_LABELS[importStatus]}
          </em>
        )}
      </span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && (
        <small className="field-error" id={name + "-error"}>
          {error}
        </small>
      )}
    </label>
  );
}

function ImportPreview({ info }) {
  const grouped = Object.entries(info.fieldStatus).reduce(
    (summary, [name, state]) => {
      summary[state].push(name);
      return summary;
    },
    { detected: [], confirm: [], missing: [] },
  );
  const fieldLabels = {
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
  const names = (items) => items.map((name) => fieldLabels[name]).join("、");

  return (
    <section className="import-preview" aria-live="polite">
      <div className="import-preview-head">
        <div>
          <p className="eyebrow">EDITABLE PREVIEW</p>
          <h3>已读取：{info.sourceMetadata.sourceName}</h3>
        </div>
        <strong>{info.sourceMetadata.filesRead.length} 个来源</strong>
      </div>
      {info.duplicateName && (
        <p className="import-duplicate" role="alert">
          已有同名项目。你仍可继续，但建议先修改项目名称以便区分。
        </p>
      )}
      <dl className="import-status-summary">
        <div>
          <dt>已检测</dt>
          <dd>{names(grouped.detected) || "无"}</dd>
        </div>
        <div>
          <dt>需确认</dt>
          <dd>{names(grouped.confirm) || "无"}</dd>
        </div>
        <div>
          <dt>未检测到</dt>
          <dd>{names(grouped.missing) || "无"}</dd>
        </div>
      </dl>
      {info.sourceMetadata.branch && (
        <p className="previous-sync">
          <GitBranch size={17} />
          {info.sourceMetadata.branch} · {info.sourceMetadata.commit || "提交未知"}
        </p>
      )}
      <p className="import-confirm-copy">请检查并补充下方字段；只有点击“创建项目”后才会保存。</p>
    </section>
  );
}

export function ProjectFormPanel({
  project,
  existingProjects = [],
  templates = [],
  collections = [],
  templateStoreError = "",
  onCreateTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
  onMoveTemplate,
  onDeleteTemplate,
  onClose,
  onSave,
  onOpenBatch,
}) {
  const editing = Boolean(project);
  const [draft, setDraft] = useState(() =>
    project ? projectToDraft(project) : { ...EMPTY_PROJECT_DRAFT },
  );
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [importInfo, setImportInfo] = useState(null);
  const panelRef = useRef(null);
  const nameRef = useRef(null);
  const initialDraft = useMemo(
    () => JSON.stringify(project ? projectToDraft(project) : EMPTY_PROJECT_DRAFT),
    [project],
  );
  const dirty = JSON.stringify(draft) !== initialDraft;

  const update = (event) => {
    const { name, type, value, checked } = event.target;
    setDraft((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setImportInfo((current) =>
      current?.fieldStatus[name]
        ? {
            ...current,
            fieldStatus: {
              ...current.fieldStatus,
              [name]: IMPORT_FIELD_STATUS.CONFIRM,
            },
          }
        : current,
    );
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
  };

  const toggleCollection = (collectionId) => {
    setDraft((current) => ({
      ...current,
      collectionIds: current.collectionIds.includes(collectionId)
        ? current.collectionIds.filter((id) => id !== collectionId)
        : [...current.collectionIds, collectionId],
    }));
  };

  const confirmDialog = useConfirmDialog();
  const requestClose = async () => {
    if (dirty) {
      const ok = await confirmDialog({
        title: "关闭表单",
        message: "尚有未保存内容，确定关闭吗？",
        confirmText: "关闭",
        danger: false,
      });
      if (!ok) return;
    }
    onClose();
  };
  useDialogFocus(panelRef, nameRef, requestClose);

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = validateProjectDraft(draft);
    setErrors(nextErrors);
    setSubmitError("");
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      document.querySelector('[name="' + firstError + '"]')?.focus();
      return;
    }

    const result = onSave(draft, importInfo?.sourceMetadata ?? null);
    if (!result.ok) setSubmitError(result.error);
  };

  return (
    <div className="scrim" onMouseDown={requestClose} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="create-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit} noValidate>
          <div className="create-head">
            <div>
              <p className="eyebrow">{editing ? "EDIT PROJECT" : "NEW PROJECT"}</p>
              <h2 id="project-form-title">{editing ? "编辑项目" : "添加项目"}</h2>
              <p>先填写核心信息，高级内容可以留空后续补充。</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={requestClose}
              aria-label={"关闭" + (editing ? "编辑" : "添加") + "项目"}
            >
              <X size={20} />
            </button>
          </div>

          {!editing && (
            <>
              <TemplateWorkspace
                type="project"
                templates={templates}
                onApply={(template) => {
                  const result = onCreateTemplate?.("apply", template, draft);
                  if (result?.ok === false) return result;
                  setDraft(result?.draft ?? draft);
                  setImportInfo(null);
                  setErrors({});
                  setSubmitError("");
                  return { ok: true };
                }}
                onCreate={(name, extraFields) =>
                  onCreateTemplate?.("create", { name, source: draft, extraFields })
                }
                onRename={onRenameTemplate}
                onDuplicate={onDuplicateTemplate}
                onMove={onMoveTemplate}
                onDelete={onDeleteTemplate}
                storeError={templateStoreError}
              />
              <ProjectImportSource
                existingProjects={existingProjects}
                onImported={(nextImport) => {
                  setDraft(nextImport.draft);
                  setImportInfo(nextImport);
                  setErrors({});
                  setSubmitError("");
                }}
              />
              <GitRepositoryImport
                existingProjects={existingProjects}
                onImported={(nextImport) => {
                  setDraft(nextImport.draft);
                  setImportInfo(nextImport);
                  setErrors({});
                  setSubmitError("");
                }}
              />
              {onOpenBatch && (
                <section className="project-import-source" aria-labelledby="batch-entry-title">
                  <div className="project-import-heading">
                    <div>
                      <p className="eyebrow">BATCH IMPORT</p>
                      <h3 id="batch-entry-title">批量导入多个项目</h3>
                    </div>
                    <span>适合一次性录入多个项目</span>
                  </div>
                  <div className="local-safety">
                    <Stack size={23} weight="duotone" />
                    <p>
                      选择父目录批量扫描子项目，或上传 CSV/JSON
                      文件；可在列表中勾选、预览后再批量创建。
                    </p>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="secondary-button" type="button" onClick={onOpenBatch}>
                      <Stack size={17} />
                      打开批量导入面板
                    </button>
                  </div>
                </section>
              )}
              {importInfo && <ImportPreview info={importInfo} />}
            </>
          )}

          {editing && (
            <TemplateWorkspace
              type="project"
              templates={templates}
              canApply={false}
              onCreate={(name, extraFields) =>
                onCreateTemplate?.("create", { name, source: draft, extraFields })
              }
              onRename={onRenameTemplate}
              onDuplicate={onDuplicateTemplate}
              onMove={onMoveTemplate}
              onDelete={onDeleteTemplate}
              storeError={templateStoreError}
            />
          )}

          <div className="form-grid">
            <FormField
              label="项目名称"
              name="name"
              error={errors.name}
              required
              importStatus={importInfo?.fieldStatus.name}
            >
              <input
                ref={nameRef}
                required
                aria-required="true"
                name="name"
                value={draft.name}
                onChange={update}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "name-error" : undefined}
                placeholder="例如：个人知识库 Agent"
              />
            </FormField>
            <FormField
              label="一句话简介"
              name="short"
              error={errors.short}
              required
              importStatus={importInfo?.fieldStatus.short}
            >
              <input
                required
                aria-required="true"
                name="short"
                value={draft.short}
                onChange={update}
                aria-invalid={Boolean(errors.short)}
                aria-describedby={errors.short ? "short-error" : undefined}
                placeholder="说明项目解决什么问题"
              />
            </FormField>
            <FormField
              label="当前状态"
              name="status"
              error={errors.status}
              required
              importStatus={importInfo?.fieldStatus.status}
            >
              <select
                required
                aria-required="true"
                name="status"
                value={draft.status}
                onChange={update}
                aria-invalid={Boolean(errors.status)}
                aria-describedby={errors.status ? "status-error" : undefined}
              >
                <option value={PROJECT_STATUSES.PLANNING}>规划中</option>
                <option value={PROJECT_STATUSES.ACTIVE}>开发中</option>
                <option value={PROJECT_STATUSES.PAUSED}>已暂停</option>
                <option value={PROJECT_STATUSES.DONE}>已完成</option>
              </select>
            </FormField>
            <FormField
              label="完成度"
              name="progress"
              error={errors.progress}
              hint="0～100"
              required
              importStatus={importInfo?.fieldStatus.progress}
            >
              <input
                required
                aria-required="true"
                name="progress"
                type="number"
                min="0"
                max="100"
                value={draft.progress}
                onChange={update}
                aria-invalid={Boolean(errors.progress)}
                aria-describedby={errors.progress ? "progress-error" : undefined}
              />
            </FormField>
            <FormField
              label="当前里程碑"
              name="milestone"
              error={errors.milestone}
              required
              importStatus={importInfo?.fieldStatus.milestone}
            >
              <input
                required
                aria-required="true"
                name="milestone"
                value={draft.milestone}
                onChange={update}
                aria-invalid={Boolean(errors.milestone)}
                aria-describedby={errors.milestone ? "milestone-error" : undefined}
                placeholder="当前正在完成的目标"
              />
            </FormField>
            <FormField
              label="完整介绍"
              name="description"
              importStatus={importInfo?.fieldStatus.description}
            >
              <textarea
                name="description"
                rows="3"
                value={draft.description}
                onChange={update}
                placeholder="补充项目背景、使用场景和目标"
              />
            </FormField>
          </div>

          <section className="project-organization-fields" aria-labelledby="organization-title">
            <div>
              <p className="eyebrow">ORGANIZATION</p>
              <h3 id="organization-title">项目组织</h3>
            </div>
            <div className="form-grid">
              <FormField
                label="项目标签"
                name="tagsText"
                error={errors.tagsText}
                hint="使用逗号或换行分隔；最多 12 个，每个最多 24 个字符"
              >
                <input
                  name="tagsText"
                  value={draft.tagsText}
                  onChange={update}
                  aria-invalid={Boolean(errors.tagsText)}
                  aria-describedby={errors.tagsText ? "tagsText-error" : undefined}
                  placeholder="例如：Agent, 本地优先, 研究"
                />
              </FormField>
              <label className="pin-project-setting">
                <input type="checkbox" name="pinned" checked={draft.pinned} onChange={update} />
                <span>
                  <strong>置顶项目</strong>
                  <small>在“最近更新”排序中优先显示。</small>
                </span>
              </label>
            </div>
            {collections.length ? (
              <fieldset className="project-collection-options">
                <legend>所属集合（可多选）</legend>
                <div>
                  {collections.map((collection) => (
                    <label key={collection.id}>
                      <input
                        type="checkbox"
                        checked={draft.collectionIds.includes(collection.id)}
                        onChange={() => toggleCollection(collection.id)}
                      />
                      <span>{collection.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="organization-empty">
                尚无自定义集合。可在“设置 → 项目集合”中创建；不选择集合不会影响项目保存。
              </p>
            )}
          </section>

          <details className="advanced-fields">
            <summary>高级信息（可选）</summary>
            <div className="form-grid advanced-grid">
              <FormField label="图标类型" name="iconKey">
                <select name="iconKey" value={draft.iconKey} onChange={update}>
                  <option value="showcase">Agent / 系统</option>
                  <option value="auralis">知识库 / 数据</option>
                  <option value="translator">文档 / 翻译</option>
                  <option value="presentation">演示 / PPT</option>
                </select>
              </FormField>
              <FormField label="本地目录" name="localPath" hint="保存为文本，不会自动打开文件系统">
                <input
                  name="localPath"
                  value={draft.localPath}
                  onChange={update}
                  placeholder="E:\\Projects\\my-agent"
                />
              </FormField>
              <FormField
                label="GitHub 地址"
                name="repositoryUrl"
                error={errors.repositoryUrl}
                importStatus={importInfo?.fieldStatus.repositoryUrl}
              >
                <input
                  name="repositoryUrl"
                  type="url"
                  value={draft.repositoryUrl}
                  onChange={update}
                  aria-invalid={Boolean(errors.repositoryUrl)}
                  aria-describedby={errors.repositoryUrl ? "repositoryUrl-error" : undefined}
                  placeholder="https://github.com/..."
                />
              </FormField>
              <FormField
                label="项目文档路径或 URL"
                name="documentationPath"
                error={errors.documentationPath}
              >
                <input
                  name="documentationPath"
                  value={draft.documentationPath}
                  onChange={update}
                  aria-invalid={Boolean(errors.documentationPath)}
                  aria-describedby={
                    errors.documentationPath ? "documentationPath-error" : undefined
                  }
                  placeholder="README 路径或 https://..."
                />
              </FormField>
              <FormField label="本地演示 URL" name="demoUrl" error={errors.demoUrl}>
                <input
                  name="demoUrl"
                  type="url"
                  value={draft.demoUrl}
                  onChange={update}
                  aria-invalid={Boolean(errors.demoUrl)}
                  aria-describedby={errors.demoUrl ? "demoUrl-error" : undefined}
                  placeholder="http://127.0.0.1:3000/"
                />
              </FormField>
              <FormField label="本地产物路径" name="previewPath">
                <input
                  name="previewPath"
                  value={draft.previewPath}
                  onChange={update}
                  placeholder="PDF、PPTX 或 HTML 文件路径"
                />
              </FormField>
              <FormField label="功能列表" name="featuresText" hint="每行：功能名称 | 状态">
                <textarea
                  name="featuresText"
                  rows="4"
                  value={draft.featuresText}
                  onChange={update}
                  placeholder={"工具调用 | 已完成\n长期记忆 | 开发中"}
                />
              </FormField>
              <FormField
                label="路线图"
                name="roadmapText"
                hint="每行：阶段 | 说明 | done/current/next"
              >
                <textarea
                  name="roadmapText"
                  rows="4"
                  value={draft.roadmapText}
                  onChange={update}
                  placeholder={"基础能力 | 完成核心流程 | done\n可靠执行 | 增加错误恢复 | current"}
                />
              </FormField>
              <FormField
                label="当前阻塞问题"
                name="blockersText"
                hint="每行一项；可使用 - [ ] / - [x] 标记状态"
                importStatus={importInfo?.fieldStatus.blockersText}
              >
                <textarea
                  name="blockersText"
                  rows="4"
                  value={draft.blockersText}
                  onChange={update}
                  placeholder={"- [ ] 等待模型选择\n- [x] 已确认数据格式"}
                />
              </FormField>
              <FormField
                label="下一步任务"
                name="nextTasksText"
                hint="每行一项；详情页可以直接勾选"
                importStatus={importInfo?.fieldStatus.nextTasksText}
              >
                <textarea
                  name="nextTasksText"
                  rows="4"
                  value={draft.nextTasksText}
                  onChange={update}
                  placeholder={"- [ ] 补充错误恢复\n- [ ] 完成浏览器测试"}
                />
              </FormField>
              <FormField
                label="语言"
                name="languagesText"
                hint="使用逗号或换行分隔"
                importStatus={importInfo?.fieldStatus.languagesText}
              >
                <input
                  name="languagesText"
                  value={draft.languagesText}
                  onChange={update}
                  placeholder="JavaScript, Python"
                />
              </FormField>
              <FormField
                label="框架与工具"
                name="frameworksText"
                hint="使用逗号或换行分隔"
                importStatus={importInfo?.fieldStatus.frameworksText}
              >
                <input
                  name="frameworksText"
                  value={draft.frameworksText}
                  onChange={update}
                  placeholder="React, Vite, FastAPI"
                />
              </FormField>
              <FormField
                label="模型"
                name="modelsText"
                hint="使用逗号或换行分隔"
                importStatus={importInfo?.fieldStatus.modelsText}
              >
                <input
                  name="modelsText"
                  value={draft.modelsText}
                  onChange={update}
                  placeholder="GPT-5, 本地嵌入模型"
                />
              </FormField>
              <FormField
                label="数据源"
                name="dataSourcesText"
                hint="使用逗号或换行分隔"
                importStatus={importInfo?.fieldStatus.dataSourcesText}
              >
                <input
                  name="dataSourcesText"
                  value={draft.dataSourcesText}
                  onChange={update}
                  placeholder="本地 Markdown, SQLite"
                />
              </FormField>
              <FormField
                label="本地启动命令"
                name="runCommand"
                importStatus={importInfo?.fieldStatus.runCommand}
              >
                <input
                  name="runCommand"
                  value={draft.runCommand}
                  onChange={update}
                  placeholder="npm run dev"
                />
              </FormField>
              <FormField label="开发记录" name="logText" hint="每行一条；留空时自动记录“创建项目”">
                <textarea
                  name="logText"
                  rows="4"
                  value={draft.logText}
                  onChange={update}
                  placeholder="完成项目初始化"
                />
              </FormField>
            </div>
          </details>

          <details className="advanced-fields agent-profile-fields">
            <summary>Agent 专属信息（可选）</summary>
            <div className="form-grid advanced-grid">
              <FormField
                label="模型版本"
                name="agentModelVersion"
                hint="模型名称与版本锁定，例如 GPT-5 2026-08"
              >
                <input
                  name="agentModelVersion"
                  value={draft.agentModelVersion}
                  onChange={update}
                  placeholder="GPT-5 2026-08"
                />
              </FormField>
              <FormField
                label="Prompt 版本"
                name="agentPromptVersion"
                hint="提示词版本或来源，例如 v1.3.0 / commit abc123"
              >
                <input
                  name="agentPromptVersion"
                  value={draft.agentPromptVersion}
                  onChange={update}
                  placeholder="v1.3.0 / commit abc123"
                />
              </FormField>
              <FormField label="数据集" name="agentDatasetsText" hint="使用逗号或换行分隔">
                <input
                  name="agentDatasetsText"
                  value={draft.agentDatasetsText}
                  onChange={update}
                  placeholder="私有知识库, MMLU 子集"
                />
              </FormField>
              <FormField label="运行环境" name="agentRuntime" hint="模型服务与依赖运行环境">
                <input
                  name="agentRuntime"
                  value={draft.agentRuntime}
                  onChange={update}
                  placeholder="Node 22 / Python 3.12 / Ollama"
                />
              </FormField>
              <FormField
                label="Token 成本"
                name="agentTokenCost"
                hint="单次或周期成本，例如 ~$0.012/次"
              >
                <input
                  name="agentTokenCost"
                  value={draft.agentTokenCost}
                  onChange={update}
                  placeholder="~$0.012/次；月度约 $40"
                />
              </FormField>
              <FormField
                label="推理参数"
                name="agentInferenceParams"
                hint="temperature、top_p、max_tokens 等"
              >
                <input
                  name="agentInferenceParams"
                  value={draft.agentInferenceParams}
                  onChange={update}
                  placeholder="temperature=0.2, top_p=0.9, max_tokens=4096"
                />
              </FormField>
            </div>
          </details>

          {submitError && (
            <p className="form-submit-error" role="alert">
              {submitError}
            </p>
          )}
          <div className="form-actions">
            <button type="button" className="secondary-button" onClick={requestClose}>
              取消
            </button>
            <button type="submit" className="primary-button">
              {editing ? (
                <PencilSimple size={18} weight="bold" />
              ) : (
                <Plus size={18} weight="bold" />
              )}
              {editing ? "保存修改" : "创建项目"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
