export function StatusBadge({ project }) {
  return (
    <span
      className={"status " + project.statusTone}
      aria-label={"项目状态：" + project.statusLabel}
    >
      <i aria-hidden="true" />
      {project.statusLabel}
    </span>
  );
}
