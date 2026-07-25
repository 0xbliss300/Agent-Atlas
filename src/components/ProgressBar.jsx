export function ProgressBar({ project }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={project.name + "完成度"}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={project.progress}
      aria-valuetext={project.progressValid ? project.progress + "%" : "原始进度无效，按 0% 显示"}
    >
      <span style={{ width: project.progress + "%" }} />
    </div>
  );
}
