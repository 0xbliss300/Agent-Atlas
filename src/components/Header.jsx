import { MagnifyingGlass, Plus } from "@phosphor-icons/react";

export function Header({
  navigate,
  activeNav,
  settingsOpen,
  onSettings,
  onAdd,
  addDisabled,
  onOpenPalette,
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate("/")} aria-label="返回项目概览">
        <img className="brand-icon" src="/agent-atlas-icon.png" alt="" aria-hidden="true" />
        <span className="brand-name">Agent Atlas</span>
        <span className="brand-divider" />
        <span className="brand-cn">个人 Agent 项目总览</span>
      </button>
      <nav aria-label="主导航">
        <button
          className={"nav-link " + (activeNav === "overview" ? "active" : "")}
          aria-current={activeNav === "overview" ? "page" : undefined}
          onClick={() => navigate("/")}
        >
          项目概览
        </button>
        <button
          className={"nav-link " + (activeNav === "workbench" ? "active" : "")}
          aria-current={activeNav === "workbench" ? "page" : undefined}
          onClick={() => navigate("/workbench")}
        >
          开发工作台
        </button>
        <button
          className={"nav-link " + (activeNav === "notes" ? "active" : "")}
          aria-current={activeNav === "notes" ? "page" : undefined}
          onClick={() => navigate("/notes")}
        >
          研究笔记
        </button>
        <button
          className={"nav-link " + (activeNav === "guide" ? "active" : "")}
          aria-current={activeNav === "guide" ? "page" : undefined}
          onClick={() => navigate("/guide")}
        >
          使用指南
        </button>
        <button
          className={"nav-link " + (activeNav === "settings" ? "active" : "")}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={onSettings}
        >
          设置
        </button>
        <button
          className="nav-link header-cmd-trigger"
          onClick={onOpenPalette}
          type="button"
          aria-label="打开命令面板（Ctrl 或 Cmd 加 K）"
          title="命令面板（Ctrl/Cmd+K）"
        >
          <MagnifyingGlass size={16} weight="bold" aria-hidden="true" />
          <span>命令</span>
        </button>
        <button className="nav-add" onClick={onAdd} disabled={addDisabled}>
          <Plus size={17} weight="bold" />
          添加项目
        </button>
      </nav>
    </header>
  );
}
