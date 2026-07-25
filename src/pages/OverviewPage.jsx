import { ArrowRight, Clock, GearSix, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { ProjectCard } from "../components/ProjectCard.jsx";
import { STATUS_FILTER_OPTIONS } from "../data/settings.js";

function EmptyState({ onAdd, disabled }) {
  return (
    <section className="empty-state" aria-labelledby="empty-title">
      <div className="empty-icon">
        <Plus size={34} weight="light" />
      </div>
      <p className="eyebrow">START YOUR ARCHIVE</p>
      <h2 id="empty-title">还没有项目</h2>
      <p>从第一个项目开始，记录开发进度、功能、路线图和本地资源。</p>
      <button className="primary-button" onClick={onAdd} disabled={disabled}>
        <Plus size={18} weight="bold" />
        创建第一个项目
      </button>
    </section>
  );
}

export function OverviewPage({
  projects,
  visibleProjects,
  summary,
  recentProjects,
  showRecent,
  onAdd,
  onOpenSettings,
  navigate,
  storeError,
  query,
  statusFilter,
  tagFilter,
  collectionFilter,
  tagOptions = [],
  collections = [],
  sortBy,
  onQueryChange,
  onStatusFilterChange,
  onTagFilterChange,
  onCollectionFilterChange,
  onSortChange,
  onTogglePin,
}) {
  const latestProject = recentProjects[0];
  const filtersActive =
    Boolean(query.trim()) ||
    statusFilter !== "all" ||
    tagFilter !== "all" ||
    collectionFilter !== "all";
  const clearFilters = () => {
    onQueryChange("");
    onStatusFilterChange("all");
    onTagFilterChange("all");
    onCollectionFilterChange("all");
  };

  return (
    <main>
      {storeError && (
        <div className="store-error" role="alert">
          <strong>本地数据读取失败</strong>
          <span>{storeError}</span>
        </div>
      )}
      <section className="overview-hero">
        <div>
          <p className="eyebrow">LOCAL-FIRST · PROJECT ARCHIVE</p>
          <h1>个人 Agent 项目总览</h1>
          <p className="hero-copy">本地优先，记录正在构建、研究与交付的 AI 项目。</p>
          <button className="hero-add" onClick={onAdd} disabled={Boolean(storeError)}>
            <Plus size={18} weight="bold" />
            添加项目
          </button>
        </div>
        <div className="summary" aria-label="项目汇总">
          <div>
            <span>全部项目</span>
            <strong>{summary.total}</strong>
            <small>个项目</small>
          </div>
          <div>
            <span>开发中</span>
            <strong>{summary.active}</strong>
            <small>个项目</small>
          </div>
          <div>
            <span>已完成</span>
            <strong>{summary.done}</strong>
            <small>个项目</small>
          </div>
          <p>
            <Clock size={17} />
            最近更新：{latestProject?.updated ?? "暂无更新"}
          </p>
        </div>
      </section>

      {projects.length > 0 && (
        <section className="project-controls" aria-label="项目搜索、筛选和排序">
          <label className="project-search">
            <span className="sr-only">搜索项目</span>
            <MagnifyingGlass size={19} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索名称、简介、标签或技术关键词"
            />
          </label>
          <label className="control-select">
            <span>标签</span>
            <select
              value={tagFilter}
              onChange={(event) => onTagFilterChange(event.target.value)}
              disabled={!tagOptions.length}
            >
              <option value="all">{tagOptions.length ? "全部标签" : "暂无标签"}</option>
              {tagOptions.map((tag) => (
                <option value={tag} key={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span>集合</span>
            <select
              value={collectionFilter}
              onChange={(event) => onCollectionFilterChange(event.target.value)}
              disabled={!collections.length}
            >
              <option value="all">{collections.length ? "全部集合" : "暂无集合"}</option>
              {collections.map((collection) => (
                <option value={collection.id} key={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span>状态</span>
            <select
              value={statusFilter}
              onChange={(event) => onStatusFilterChange(event.target.value)}
            >
              {STATUS_FILTER_OPTIONS.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span>排序</span>
            <select value={sortBy} onChange={(event) => onSortChange(event.target.value)}>
              <option value="updated">最近更新</option>
              <option value="progress">完成度</option>
              <option value="status">项目状态</option>
            </select>
          </label>
          <p className="filter-result" aria-live="polite">
            显示 {visibleProjects.length} / {projects.length} 个项目
          </p>
          {filtersActive && (
            <button className="clear-filters" onClick={clearFilters}>
              <X size={16} />
              清除筛选
            </button>
          )}
        </section>
      )}

      {projects.length === 0 ? (
        <EmptyState onAdd={onAdd} disabled={Boolean(storeError)} />
      ) : visibleProjects.length === 0 ? (
        <section className="empty-state filtered-empty" aria-labelledby="filtered-empty-title">
          <p className="eyebrow">DISPLAY FILTER</p>
          <h2 id="filtered-empty-title">当前设置下没有可显示的项目</h2>
          <p>
            {filtersActive
              ? collectionFilter !== "all"
                ? "所选集合当前为空，或其中项目不符合其他筛选条件。"
                : "没有匹配当前关键词、状态、标签或集合的项目。"
              : "已完成项目可能被隐藏，可以在设置中重新显示。"}
          </p>
          <div className="empty-actions">
            {filtersActive && (
              <button className="primary-button" onClick={clearFilters}>
                <X size={18} />
                清除筛选
              </button>
            )}
            <button className="secondary-button" onClick={onOpenSettings}>
              <GearSix size={18} />
              打开显示设置
            </button>
          </div>
        </section>
      ) : (
        <section className="project-grid" aria-label="项目列表">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpen={() => navigate("/project/" + project.id)}
              onTogglePin={onTogglePin}
            />
          ))}
        </section>
      )}

      {showRecent && recentProjects.length > 0 && (
        <section className="recent" id="recent">
          <div className="section-title">
            <h2>最近更新</h2>
            <span>动态</span>
            <button onClick={() => navigate("/project/" + latestProject.id)}>
              查看最新 <ArrowRight size={18} />
            </button>
          </div>
          <div className="activity-grid">
            {recentProjects.map((project) => (
              <button
                key={project.id}
                className="activity"
                onClick={() => navigate("/project/" + project.id)}
              >
                <span className={"activity-dot " + project.statusTone} />
                <small>
                  {project.updated} {project.updatedTime}
                </small>
                <span>
                  {project.name}：{project.log[0] ?? project.milestone}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
