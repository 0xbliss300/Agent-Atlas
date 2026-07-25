import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Circle,
  Clock,
  Code,
  Copy,
  Cpu,
  Database,
  FileText,
  FileCode,
  FolderOpen,
  GearSix,
  GitBranch,
  GithubLogo,
  LinkSimple,
  ListChecks,
  NotePencil,
  PencilSimple,
  Plus,
  TerminalWindow,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { ProgressBar } from "../components/ProgressBar.jsx";
import { ProjectTimeline } from "../components/ProjectTimeline.jsx";
import { ResourceAction } from "../components/ResourceAction.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { writeClipboardText } from "../utils/clipboard.js";
import { getProjectIcon } from "../utils/projectIcons.js";

function InlineEmpty({ children }) {
  return <p className="inline-empty">{children}</p>;
}

function TechnologyGroup({ Icon, label, items }) {
  return (
    <div className="technology-group">
      <Icon size={19} />
      <span>{label}</span>
      {items.length ? (
        <div className="technology-tags">
          {items.map((item) => (
            <code key={item}>{item}</code>
          ))}
        </div>
      ) : (
        <small>未配置</small>
      )}
    </div>
  );
}

export function ProjectDetailPage({
  project,
  researchNotes = [],
  projectEvents = [],
  eventStoreError = null,
  notesMode,
  navigate,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleTask,
  onOpenSync,
  onOpenCodexContext,
  onNewResearchNote,
}) {
  const Icon = getProjectIcon(project);
  const [copyStatus, setCopyStatus] = useState(null);
  const activeBlockers = project.blockers.filter((item) => !item.done);

  useEffect(() => {
    if (!copyStatus) return undefined;
    const timer = window.setTimeout(() => setCopyStatus(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (notesMode) {
      window.setTimeout(
        () => document.querySelector("#research-notes")?.scrollIntoView({ behavior: "smooth" }),
        60,
      );
    }
  }, [notesMode]);

  const copyResource = async (key, value) => {
    try {
      await writeClipboardText(value);
      setCopyStatus({ key, message: "已复制" });
    } catch {
      setCopyStatus({ key, message: "复制失败" });
    }
  };

  const previewDetail = project.demoUrl ? "打开本地运行地址" : (project.previewPath ?? "暂未配置");

  return (
    <main className="detail-page">
      <div className="detail-toolbar">
        <button className="back-link" onClick={() => navigate("/")}>
          <ArrowLeft size={18} />
          返回项目总览
        </button>
        <div className="manage-actions" aria-label="项目管理">
          <button className="secondary-button" onClick={onOpenCodexContext}>
            <FileCode size={17} />
            生成 Codex 上下文
          </button>
          <button className="secondary-button" onClick={onEdit}>
            <PencilSimple size={17} />
            编辑
          </button>
          <button className="secondary-button" onClick={onDuplicate}>
            <Copy size={17} />
            复制
          </button>
          <button className="danger-button" onClick={onDelete}>
            <Trash size={17} />
            删除
          </button>
        </div>
      </div>

      <section className="detail-hero">
        <div className="detail-icon">
          <Icon size={60} weight="duotone" />
        </div>
        <div className="detail-intro">
          <div className="detail-title-row">
            <h1>{project.name}</h1>
            <StatusBadge project={project} />
          </div>
          <p>{project.description}</p>
          <div className="detail-actions">
            <ResourceAction
              compact
              Icon={GithubLogo}
              label="GitHub 仓库"
              href={project.repositoryUrl}
              copyKey="repository"
              copyStatus={copyStatus}
              onCopy={copyResource}
            />
            <ResourceAction
              compact
              Icon={FolderOpen}
              label="复制本地目录"
              copyValue={project.localPath}
              copyKey="local-path"
              copyStatus={copyStatus}
              onCopy={copyResource}
            />
            <ResourceAction
              compact
              Icon={FileText}
              label="复制文档路径"
              copyValue={project.documentationPath}
              copyKey="documentation"
              copyStatus={copyStatus}
              onCopy={copyResource}
            />
            <ResourceAction
              compact
              Icon={LinkSimple}
              label={project.demoUrl ? "打开本地演示" : "复制本地产物"}
              href={project.demoUrl}
              copyValue={project.previewPath}
              copyKey="preview"
              copyStatus={copyStatus}
              onCopy={copyResource}
            />
          </div>
          <p className="copy-feedback" aria-live="polite">
            {copyStatus
              ? copyStatus.message + "：项目资源"
              : "本地文件入口会复制路径，不会向外部发送数据。"}
          </p>
        </div>
        <div className="detail-progress">
          <span>开发完成度</span>
          <strong>{project.progress}%</strong>
          <ProgressBar project={project} />
          {!project.progressValid && (
            <small className="data-warning">原始进度无效，已按 0% 显示</small>
          )}
          <small>更新于 {project.updated}</small>
        </div>
      </section>

      <section className="detail-grid">
        <div className="detail-block features-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">CAPABILITIES</p>
              <h2>功能进度</h2>
            </div>
            <GearSix size={24} />
          </div>
          {project.features.length ? (
            <div className="feature-list">
              {project.features.map(([name, state, done]) => (
                <div className="feature-row" key={name}>
                  {done ? <CheckCircle size={21} weight="fill" /> : <Circle size={21} />}
                  <span>{name}</span>
                  <small>{state}</small>
                </div>
              ))}
            </div>
          ) : (
            <InlineEmpty>尚未添加功能列表。</InlineEmpty>
          )}
        </div>

        <div className="detail-block links-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">QUICK LINKS</p>
              <h2>项目链接</h2>
            </div>
            <LinkSimple size={24} />
          </div>
          <ResourceAction
            Icon={GithubLogo}
            label="GitHub 仓库"
            detail={project.repositoryUrl ?? "暂未配置"}
            href={project.repositoryUrl}
            copyKey="repository"
            copyStatus={copyStatus}
            onCopy={copyResource}
          />
          <ResourceAction
            Icon={FileText}
            label="项目说明"
            detail={project.documentationPath ?? "暂未配置"}
            copyValue={project.documentationPath}
            copyKey="documentation"
            copyStatus={copyStatus}
            onCopy={copyResource}
          />
          <ResourceAction
            Icon={FolderOpen}
            label="本地目录"
            detail={project.localPath ?? "暂未配置"}
            copyValue={project.localPath}
            copyKey="local-path"
            copyStatus={copyStatus}
            onCopy={copyResource}
          />
          <ResourceAction
            Icon={LinkSimple}
            label={project.demoUrl ? "本地演示" : "本地产物"}
            detail={previewDetail}
            href={project.demoUrl}
            copyValue={project.previewPath}
            copyKey="preview"
            copyStatus={copyStatus}
            onCopy={copyResource}
          />
          <ResourceAction
            Icon={NotePencil}
            label="研究笔记"
            detail={
              researchNotes.length
                ? `${researchNotes.length} 篇 Markdown 研究笔记`
                : "新建 Markdown 研究笔记"
            }
            href={
              researchNotes.length
                ? "#/notes/" + encodeURIComponent(researchNotes[0].id)
                : "#/notes/new/project/" + encodeURIComponent(project.id)
            }
            copyKey="notes"
            copyStatus={copyStatus}
            onCopy={copyResource}
          />
        </div>
      </section>

      <section className="detail-grid work-state-grid">
        <div className="detail-block blockers-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">BLOCKERS</p>
              <h2>当前阻塞问题</h2>
            </div>
            <WarningCircle size={24} />
          </div>
          {activeBlockers.length ? (
            <ul className="blocker-list">
              {activeBlockers.map((blocker) => (
                <li key={blocker.id}>
                  <WarningCircle size={19} weight="fill" />
                  <span>{blocker.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <InlineEmpty>当前没有未解决的阻塞问题。</InlineEmpty>
          )}
        </div>

        <div className="detail-block tasks-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">NEXT ACTIONS</p>
              <h2>下一步任务</h2>
            </div>
            <ListChecks size={24} />
          </div>
          {project.nextTasks.length ? (
            <div className="task-list">
              {project.nextTasks.map((task) => (
                <label className={"task-row " + (task.done ? "done" : "")} key={task.id}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => onToggleTask(task.id)}
                  />
                  <span>{task.title}</span>
                  <small>{task.done ? "已完成" : "待执行"}</small>
                </label>
              ))}
            </div>
          ) : (
            <InlineEmpty>尚未拆解下一步任务，可通过编辑项目添加。</InlineEmpty>
          )}
        </div>
      </section>

      <section className="detail-grid technical-grid">
        <div className="detail-block technology-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">TECHNICAL PROFILE</p>
              <h2>技术栈与运行信息</h2>
            </div>
            <Code size={24} />
          </div>
          <div className="technology-list">
            <TechnologyGroup Icon={Code} label="语言" items={project.technology.languages} />
            <TechnologyGroup Icon={GearSix} label="框架" items={project.technology.frameworks} />
            <TechnologyGroup Icon={Cpu} label="模型" items={project.technology.models} />
            <TechnologyGroup
              Icon={Database}
              label="数据源"
              items={project.technology.dataSources}
            />
            <div className="technology-group run-command">
              <TerminalWindow size={19} />
              <span>本地启动</span>
              {project.technology.runCommand ? (
                <code>{project.technology.runCommand}</code>
              ) : (
                <small>未配置</small>
              )}
            </div>
          </div>
        </div>

        <div className="detail-block sync-block">
          <div className="block-heading">
            <div>
              <p className="eyebrow">LOCAL STATUS</p>
              <h2>本地状态读取</h2>
            </div>
            <ArrowsClockwise size={24} />
          </div>
          <p>主动选择 JSON、Markdown 或项目目录，只读提取进度、任务、技术依赖与 Git 信息。</p>
          {project.localSync ? (
            <dl className="sync-summary">
              <div>
                <dt>来源</dt>
                <dd>{project.localSync.sourceName || "本地来源"}</dd>
              </div>
              <div>
                <dt>Git 分支</dt>
                <dd>{project.localSync.branch || "未读取"}</dd>
              </div>
              <div>
                <dt>提交</dt>
                <dd>{project.localSync.commit || "未读取"}</dd>
              </div>
              <div>
                <dt>文件</dt>
                <dd>{project.localSync.filesRead.length} 个</dd>
              </div>
            </dl>
          ) : (
            <InlineEmpty>尚未读取本地状态。</InlineEmpty>
          )}
          <button className="primary-button sync-button" onClick={onOpenSync}>
            <GitBranch size={18} />
            读取本地状态
          </button>
        </div>
      </section>

      <section className="detail-block roadmap-block">
        <div className="block-heading">
          <div>
            <p className="eyebrow">ROADMAP</p>
            <h2>项目路线图</h2>
          </div>
          <span className="updated">当前里程碑：{project.milestone}</span>
        </div>
        {project.roadmap.length ? (
          <div className="roadmap">
            {project.roadmap.map(([title, text, state], index) => (
              <div className={"roadmap-step " + state} key={title + "-" + index}>
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>
                    {state === "done" ? "已完成" : state === "current" ? "进行中" : "下一步"}
                  </small>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <InlineEmpty>尚未添加路线图，当前里程碑为“{project.milestone}”。</InlineEmpty>
        )}
      </section>

      <section className="detail-block project-notes-block">
        <div className="block-heading">
          <div>
            <p className="eyebrow">RESEARCH DOCUMENTS</p>
            <h2>项目研究笔记</h2>
          </div>
          <button className="secondary-button" onClick={onNewResearchNote}>
            <Plus size={17} />
            新建笔记
          </button>
        </div>
        {researchNotes.length ? (
          <div className="project-note-links">
            {researchNotes.map((note) => (
              <a
                href={"#/notes/" + encodeURIComponent(note.id)}
                onClick={(event) => {
                  event.preventDefault();
                  navigate("/notes/" + note.id);
                }}
                key={note.id}
              >
                <span>
                  <strong>{note.title}</strong>
                  <small>
                    更新于 {note.updated} {note.updatedTime}
                  </small>
                </span>
                <ArrowRight size={18} />
              </a>
            ))}
          </div>
        ) : (
          <InlineEmpty>尚未创建 Markdown 研究笔记，可从这里开始记录项目研究过程。</InlineEmpty>
        )}
      </section>

      <ProjectTimeline
        projectId={project.id}
        events={projectEvents}
        storeError={eventStoreError}
        navigate={navigate}
      />

      <section className="detail-block log-block" id="research-notes">
        <div className="block-heading">
          <div>
            <p className="eyebrow">CHANGELOG</p>
            <h2>人工开发记录</h2>
          </div>
          <Clock size={24} />
        </div>
        {project.log.length ? (
          project.log.map((item, index) => (
            <div className="log-row" key={item + "-" + index}>
              <time>{project.updated}</time>
              <span>{item}</span>
              <small>{index === 0 ? "最新" : "记录"}</small>
            </div>
          ))
        ) : (
          <InlineEmpty>尚未添加人工开发记录，可通过编辑项目补充阶段摘要。</InlineEmpty>
        )}
      </section>
    </main>
  );
}
