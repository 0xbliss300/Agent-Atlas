import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, ArrowBendDownLeft } from "@phosphor-icons/react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { fuzzyFilter } from "../data/fuzzy.js";

const MAX_RESULTS = 12;

const HELP_SHORTCUTS = Object.freeze([
  { keys: "Ctrl / Cmd + K", desc: "打开命令面板" },
  { keys: "/", desc: "聚焦搜索" },
  { keys: "n", desc: "新建项目" },
  { keys: "g w", desc: "跳转到开发工作台" },
  { keys: "g n", desc: "跳转到研究笔记" },
  { keys: "?", desc: "查看快捷键" },
  { keys: "Esc", desc: "关闭面板 / 弹窗" },
]);

function buildCommands({ navigate, onNewProject, onNewNote, onOpenSettings, projects, notes }) {
  const actions = [
    { id: "action:new-project", label: "新建项目", hint: "n", run: onNewProject },
    { id: "action:new-note", label: "新建研究笔记", hint: "g n", run: onNewNote },
    { id: "action:settings", label: "打开设置", run: onOpenSettings },
    {
      id: "nav:overview",
      label: "跳转到：项目概览",
      run: () => navigate("/"),
    },
    {
      id: "nav:workbench",
      label: "跳转到：开发工作台",
      run: () => navigate("/workbench"),
    },
    {
      id: "nav:notes",
      label: "跳转到：研究笔记",
      run: () => navigate("/notes"),
    },
    {
      id: "nav:guide",
      label: "跳转到：使用指南",
      run: () => navigate("/guide"),
    },
  ];
  const projectCommands = projects.map((project) => ({
    id: `project:${project.id}`,
    label: `项目：${project.name}`,
    run: () => navigate(`/project/${encodeURIComponent(project.id)}`),
  }));
  const noteCommands = notes.map((note) => ({
    id: `note:${note.id}`,
    label: `笔记：${note.title}`,
    run: () => navigate(`/notes/${encodeURIComponent(note.id)}`),
  }));
  return [...actions, ...projectCommands, ...noteCommands];
}

export function CommandPalette({
  open,
  initialHelp = false,
  onClose,
  navigate,
  onNewProject,
  onNewNote,
  onOpenSettings,
  projects = [],
  researchNotes = [],
}) {
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [helpMode, setHelpMode] = useState(initialHelp);
  useDialogFocus(panelRef, inputRef, onClose);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setHelpMode(initialHelp);
    }
  }, [open, initialHelp]);

  const commands = useMemo(
    () =>
      buildCommands({
        navigate,
        onNewProject,
        onNewNote,
        onOpenSettings,
        projects,
        notes: researchNotes,
      }),
    [navigate, onNewProject, onNewNote, onOpenSettings, projects, researchNotes],
  );
  const filtered = useMemo(
    () => fuzzyFilter(commands, query, (command) => command.label).slice(0, MAX_RESULTS),
    [commands, query],
  );

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  const execute = (command) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (filtered.length ? (index + 1) % filtered.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        filtered.length ? (index - 1 + filtered.length) % filtered.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      execute(filtered[activeIndex]);
    } else if (event.key === "?") {
      event.preventDefault();
      setHelpMode((mode) => !mode);
    }
  };

  if (!open) return null;

  return (
    <div className="scrim" onMouseDown={onClose} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="command-palette-title" className="sr-only">
          命令面板
        </h2>
        <div className="command-palette-input">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={helpMode ? "快捷键帮助" : "搜索项目、笔记或输入命令…"}
            aria-label="命令面板搜索"
            aria-controls="command-palette-list"
          />
          <kbd className="kbd-hint">Esc</kbd>
        </div>

        {helpMode ? (
          <ul className="command-help" id="command-palette-list">
            {HELP_SHORTCUTS.map((shortcut) => (
              <li key={shortcut.keys} className="command-help-row">
                <kbd className="kbd-hint">{shortcut.keys}</kbd>
                <span>{shortcut.desc}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className="command-list"
            id="command-palette-list"
            role="listbox"
            aria-label="命令结果"
          >
            {filtered.length === 0 ? (
              <li className="command-empty">没有匹配的命令</li>
            ) : (
              filtered.map((command, index) => (
                <li key={command.id}>
                  <button
                    type="button"
                    className={"command-item" + (index === activeIndex ? " active" : "")}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => execute(command)}
                  >
                    <span className="command-item-label">{command.label}</span>
                    {command.hint ? <kbd className="kbd-hint">{command.hint}</kbd> : null}
                    {index === activeIndex ? (
                      <ArrowBendDownLeft size={15} className="command-enter" aria-hidden="true" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        <p className="sr-only" aria-live="polite">
          {helpMode ? `快捷键帮助，共 ${HELP_SHORTCUTS.length} 项` : `共 ${filtered.length} 条结果`}
        </p>
      </section>
    </div>
  );
}
