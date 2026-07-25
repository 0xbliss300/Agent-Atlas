import {
  ArrowRight,
  CheckCircle,
  ClockCounterClockwise,
  FolderOpen,
  NotePencil,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { createWorkbenchModel, filterWorkbenchItems } from "../data/workbench.js";

function SourceLink({ item, navigate }) {
  const isNote = item.type === "note";
  const path = isNote ? `/notes/${item.entryId}` : `/project/${item.projectId}`;
  return (
    <a
      className="workbench-source-link"
      href={`#${path}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(path);
      }}
    >
      {isNote ? "打开研究笔记" : "返回来源项目"}
      <ArrowRight size={15} aria-hidden="true" />
    </a>
  );
}

function WorkbenchItem({ item, navigate, onToggleTask, onResolveBlocker, onFeedback }) {
  const update = (action, successMessage) => {
    const result = action();
    onFeedback(result?.ok === false ? result.error : result?.message || successMessage);
  };

  return (
    <article className={`workbench-item workbench-item-${item.type}`}>
      <div className="workbench-item-icon" aria-hidden="true">
        {item.type === "blocker" ? (
          <Warning size={20} weight="fill" />
        ) : item.type === "task" ? (
          <CheckCircle size={20} />
        ) : item.type === "note" ? (
          <NotePencil size={20} />
        ) : (
          <ClockCounterClockwise size={20} />
        )}
      </div>
      <div className="workbench-item-body">
        <div className="workbench-item-meta">
          <span>{item.projectName}</span>
          <span>
            {item.type === "blocker"
              ? "未解决阻塞"
              : item.type === "task"
                ? item.done
                  ? "已完成任务"
                  : "下一步任务"
                : item.type === "note"
                  ? "研究笔记"
                  : item.stale
                    ? `可能停滞 · ${item.inactiveDays} 天未更新`
                    : item.statusLabel}
          </span>
        </div>
        {item.type === "task" ? (
          <label className="workbench-task">
            <input
              type="checkbox"
              checked={item.done}
              onChange={() =>
                update(
                  () => onToggleTask(item.projectId, item.entryId),
                  item.done ? "任务已恢复为待办。" : "任务已标记完成。",
                )
              }
            />
            <span>{item.title}</span>
          </label>
        ) : (
          <h3>{item.title}</h3>
        )}
        {item.description ? <p>{item.description}</p> : null}
        <div className="workbench-item-actions">
          {item.type === "blocker" ? (
            <button
              type="button"
              className="workbench-resolve"
              onClick={() =>
                update(() => onResolveBlocker(item.projectId, item.entryId), "阻塞项已标记解决。")
              }
            >
              标记已解决
            </button>
          ) : null}
          <SourceLink item={item} navigate={navigate} />
        </div>
      </div>
    </article>
  );
}

function EmptyQueue({ projectCount, type, filtered, onAddProject, onClear }) {
  if (!projectCount) {
    return (
      <div className="workbench-empty">
        <FolderOpen size={32} aria-hidden="true" />
        <h3>还没有可汇总的项目</h3>
        <p>先添加一个真实项目，工作台会从其任务、阻塞项和更新时间派生执行视图。</p>
        <button type="button" className="primary-action" onClick={onAddProject}>
          添加第一个项目
        </button>
      </div>
    );
  }
  const message =
    type === "blocker"
      ? "当前范围内没有未解决阻塞，可以继续推进下一步任务。"
      : type === "task"
        ? "当前范围内没有任务，请回到项目补充下一步行动。"
        : filtered
          ? "没有符合当前筛选条件的内容。"
          : "当前没有未解决阻塞、待办任务或可能停滞项目。";
  return (
    <div className="workbench-empty">
      <CheckCircle size={32} aria-hidden="true" />
      <h3>当前队列为空</h3>
      <p>{message}</p>
      {filtered ? (
        <button type="button" className="secondary-action" onClick={onClear}>
          清除筛选
        </button>
      ) : null}
    </div>
  );
}

export function WorkbenchPage({
  projects,
  researchNotes,
  navigate,
  onAddProject,
  onToggleTask,
  onResolveBlocker,
  storeError,
  collections = [],
}) {
  const model = useMemo(
    () => createWorkbenchModel(projects, researchNotes),
    [projects, researchNotes],
  );
  const [projectId, setProjectId] = useState("all");
  const [type, setType] = useState("all");
  const [collectionId, setCollectionId] = useState("all");
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    if (
      collectionId !== "all" &&
      !collections.some((collection) => collection.id === collectionId)
    ) {
      setCollectionId("all");
    }
  }, [collectionId, collections]);
  const items = useMemo(
    () => filterWorkbenchItems(model, { projectId, type, collectionId }),
    [collectionId, model, projectId, type],
  );
  const filtered = projectId !== "all" || type !== "all" || collectionId !== "all";
  const clearFilters = () => {
    setProjectId("all");
    setType("all");
    setCollectionId("all");
  };

  return (
    <main className="workbench-page">
      <section className="workbench-hero" aria-labelledby="workbench-title">
        <div>
          <p className="eyebrow">LOCAL EXECUTION · DERIVED VIEW</p>
          <h1 id="workbench-title">开发工作台</h1>
          <p className="workbench-intro">
            把跨项目的关键阻塞、下一步任务和近期上下文集中到一个可执行视图。
            所有内容都从现有本地数据实时派生，不另存汇总副本。
          </p>
        </div>
        <dl className="workbench-summary" aria-label="工作台统计">
          <div>
            <dt>任务总数</dt>
            <dd>{model.summary.totalTasks}</dd>
            <small>{model.summary.pendingTasks} 项待办</small>
          </div>
          <div>
            <dt>未解决阻塞</dt>
            <dd>{model.summary.unresolvedBlockers}</dd>
            <small>优先处理</small>
          </div>
          <div>
            <dt>活跃项目</dt>
            <dd>{model.summary.activeProjects}</dd>
            <small>{model.summary.pausedProjects} 个暂停</small>
          </div>
          <div>
            <dt>可能停滞</dt>
            <dd>{model.summary.staleProjects}</dd>
            <small>派生判断</small>
          </div>
        </dl>
      </section>

      {storeError ? (
        <div className="store-error" role="alert">
          <Warning size={20} weight="fill" />
          <span>{storeError}</span>
        </div>
      ) : null}

      <section className="workbench-rule" aria-label="停滞判断说明">
        <ClockCounterClockwise size={20} aria-hidden="true" />
        <p>
          <strong>“可能停滞”不是项目事实：</strong>
          仅表示项目尚未完成，且距离最后更新时间已连续达到 14 天。
        </p>
      </section>

      <section className="workbench-controls" aria-label="工作台筛选">
        <label>
          <span>项目</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            aria-label="按项目筛选"
          >
            <option value="all">全部项目</option>
            {model.projectOptions.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>集合</span>
          <select
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
            aria-label="按集合筛选"
            disabled={!collections.length}
          >
            <option value="all">{collections.length ? "全部集合" : "暂无集合"}</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>内容类型</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            aria-label="按内容类型筛选"
          >
            <option value="all">默认执行队列</option>
            <option value="blocker">未解决阻塞</option>
            <option value="task">全部任务</option>
            <option value="project">活跃 / 暂停项目</option>
            <option value="note">研究笔记</option>
          </select>
        </label>
        <p className="workbench-result" aria-live="polite">
          当前显示 {items.length} 项
        </p>
        {filtered ? (
          <button type="button" className="clear-filters" onClick={clearFilters}>
            清除筛选
          </button>
        ) : null}
      </section>

      {feedback ? (
        <p className="workbench-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      ) : (
        <span className="sr-only" role="status" aria-live="polite">
          等待工作台操作
        </span>
      )}

      <section className="workbench-queue" aria-labelledby="queue-title">
        <div className="workbench-section-heading">
          <div>
            <p className="eyebrow">PRIORITY QUEUE</p>
            <h2 id="queue-title">接下来做什么</h2>
          </div>
          <p>默认顺序：阻塞 → 活跃任务 → 其他任务 → 可能停滞项目</p>
        </div>
        {items.length ? (
          <div className="workbench-items">
            {items.map((item) => (
              <WorkbenchItem
                key={item.id}
                item={item}
                navigate={navigate}
                onToggleTask={onToggleTask}
                onResolveBlocker={onResolveBlocker}
                onFeedback={setFeedback}
              />
            ))}
          </div>
        ) : (
          <EmptyQueue
            projectCount={projects.length}
            type={type}
            filtered={filtered}
            onAddProject={onAddProject}
            onClear={clearFilters}
          />
        )}
      </section>

      {projects.length ? (
        <section className="workbench-context" aria-labelledby="context-title">
          <div className="workbench-section-heading">
            <div>
              <p className="eyebrow">RECENT CONTEXT</p>
              <h2 id="context-title">近期来源</h2>
            </div>
            <p>回到最近更新的项目或研究笔记继续开发。</p>
          </div>
          <div className="workbench-context-grid">
            <div>
              <h3>最近项目</h3>
              {model.recentProjects.length ? (
                <ul>
                  {model.recentProjects.map((project) => (
                    <li key={project.id}>
                      <a
                        href={`#/project/${project.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/project/${project.id}`);
                        }}
                      >
                        <span>{project.name}</span>
                        <time dateTime={project.updatedAt}>{project.updated}</time>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workbench-inline-empty">暂无最近项目。</p>
              )}
            </div>
            <div>
              <h3>最近研究笔记</h3>
              {model.recentNotes.length ? (
                <ul>
                  {model.recentNotes.map((note) => (
                    <li key={note.id}>
                      <a
                        href={`#/notes/${note.entryId}`}
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(`/notes/${note.entryId}`);
                        }}
                      >
                        <span>{note.title}</span>
                        <time dateTime={note.updatedAt}>{note.updatedAt.slice(0, 10)}</time>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="workbench-inline-empty">暂无研究笔记，可从任一项目开始记录。</p>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
