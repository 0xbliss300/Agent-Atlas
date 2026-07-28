import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette.jsx";

const projects = [{ id: "p1", name: "知识库 Agent" }];
const notes = [{ id: "n1", title: "检索实验", projectId: "p1" }];

function renderPalette(overrides = {}) {
  const navigate = vi.fn();
  const onNewProject = vi.fn();
  const onNewNote = vi.fn();
  const onOpenSettings = vi.fn();
  const onClose = vi.fn();
  render(
    <CommandPalette
      open
      onClose={onClose}
      navigate={navigate}
      onNewProject={onNewProject}
      onNewNote={onNewNote}
      onOpenSettings={onOpenSettings}
      projects={projects}
      researchNotes={notes}
      {...overrides}
    />,
  );
  return { navigate, onNewProject, onNewNote, onOpenSettings, onClose };
}

describe("CommandPalette 命令面板", () => {
  it("模糊搜索项目并回车执行跳转", () => {
    const { navigate, onClose } = renderPalette();
    const input = screen.getByRole("searchbox", { name: "命令面板搜索" });
    fireEvent.change(input, { target: { value: "知识" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith("/project/p1");
    expect(onClose).toHaveBeenCalled();
  });

  it("? 切换快捷键帮助模式", () => {
    renderPalette();
    expect(screen.queryByText("Ctrl / Cmd + K")).not.toBeInTheDocument();
    const input = screen.getByRole("searchbox", { name: "命令面板搜索" });
    fireEvent.keyDown(input, { key: "?" });
    expect(screen.getByText("Ctrl / Cmd + K")).toBeInTheDocument();
    expect(screen.getByText("聚焦搜索")).toBeInTheDocument();
  });

  it("无匹配命令时显示空状态", () => {
    renderPalette();
    fireEvent.change(screen.getByRole("searchbox", { name: "命令面板搜索" }), {
      target: { value: "zzz不存在的命令" },
    });
    expect(screen.getByText("没有匹配的命令")).toBeInTheDocument();
  });

  it("Esc 关闭命令面板", () => {
    const { onClose } = renderPalette();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
