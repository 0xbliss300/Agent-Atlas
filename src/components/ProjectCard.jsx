import { ArrowRight, CalendarDots, Flag, PushPin } from "@phosphor-icons/react";
import { getProjectIcon } from "../utils/projectIcons.js";
import { ProgressBar } from "./ProgressBar.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

export function ProjectCard({ project, onOpen, onTogglePin = () => {} }) {
  const Icon = getProjectIcon(project);

  return (
    <article className="project-card">
      <a
        className="project-card-link"
        href={"#/project/" + encodeURIComponent(project.id)}
        onClick={(event) => {
          event.preventDefault();
          onOpen();
        }}
        onKeyDown={(event) => {
          if (event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        aria-label={
          "查看项目：" +
          project.name +
          "，状态" +
          project.statusLabel +
          "，完成度" +
          project.progress +
          "%"
        }
      >
        <div className="card-top">
          <div className="project-icon">
            <Icon size={48} weight="duotone" />
          </div>
          <div className="project-heading">
            <h2>{project.name}</h2>
            <p>{project.short}</p>
          </div>
          <StatusBadge project={project} />
        </div>
        <div className="progress-row">
          <div className="progress-main">
            <span className="meta-label">进度</span>
            <ProgressBar project={project} />
          </div>
          <strong>{project.progress}%</strong>
        </div>
        {!project.progressValid && <p className="data-warning">进度数据无效，已按 0% 显示。</p>}
        {project.tags?.length > 0 && (
          <div className="project-card-tags" aria-label={`项目标签：${project.tags.join("、")}`}>
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
            {project.tags.length > 3 && <span>+{project.tags.length - 3}</span>}
          </div>
        )}
        <div className="card-meta">
          <div>
            <Flag size={18} />
            <span>
              <small>最新里程碑</small>
              {project.milestone}
            </span>
          </div>
          <div>
            <CalendarDots size={18} />
            <span>
              <small>更新于</small>
              {project.updated}
            </span>
          </div>
        </div>
        <span className="card-link">
          查看项目 <ArrowRight size={20} />
        </span>
      </a>
      <button
        type="button"
        className={`card-pin-button${project.pinned ? " is-pinned" : ""}`}
        onClick={() => onTogglePin(project.id, !project.pinned)}
        aria-pressed={project.pinned}
        aria-label={project.pinned ? `取消置顶${project.name}` : `置顶${project.name}`}
        title={project.pinned ? "取消置顶" : "置顶"}
      >
        <PushPin size={17} weight={project.pinned ? "fill" : "regular"} />
      </button>
    </article>
  );
}
