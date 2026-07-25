import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResearchNotesPage } from "./ResearchNotesPage.jsx";

const project = {
  id: "project-1",
  name: "知识库 Agent",
  updatedTimestamp: 100,
};

const researchNote = {
  id: "note-1",
  projectId: "project-1",
  title: "本地索引实验",
  body: "# 结论\n\n索引流程已经跑通。",
  created: "2026-07-24",
  updatedAt: "2026-07-25T12:00:00.000+08:00",
  updated: "2026-07-25",
  updatedTime: "12:00",
};

const activityNote = {
  id: "project-1:note:0",
  projectId: "project-1",
  projectName: "知识库 Agent",
  statusLabel: "开发中",
  statusTone: "active",
  content: "完成本地索引",
  updatedAt: "2026-07-25T12:00:00.000+08:00",
  updated: "2026-07-25",
  updatedTime: "12:00",
};

describe("ResearchNotesPage", () => {
  it("展示 Markdown 文档和独立开发记录摘要", () => {
    const navigate = vi.fn();
    render(
      <ResearchNotesPage
        projects={[project]}
        researchNotes={[researchNote]}
        activityNotes={[activityNote]}
        onAddProject={() => {}}
        onNewNote={() => {}}
        navigate={navigate}
        storeError={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "研究笔记" })).toBeInTheDocument();
    expect(screen.getByText("本地索引实验")).toBeInTheDocument();
    expect(screen.getByText("完成本地索引")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "阅读研究笔记：本地索引实验" }));
    expect(navigate).toHaveBeenCalledWith("/notes/note-1");
  });

  it("无项目时显示创建入口", () => {
    const onAddProject = vi.fn();
    render(
      <ResearchNotesPage
        projects={[]}
        researchNotes={[]}
        activityNotes={[]}
        onAddProject={onAddProject}
        onNewNote={() => {}}
        navigate={() => {}}
        storeError={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "还没有项目" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "创建第一个项目" }));
    expect(onAddProject).toHaveBeenCalledOnce();
  });

  it("有项目但无 Markdown 文档时提供新建入口", () => {
    const onNewNote = vi.fn();
    render(
      <ResearchNotesPage
        projects={[project]}
        researchNotes={[]}
        activityNotes={[]}
        onAddProject={() => {}}
        onNewNote={onNewNote}
        navigate={() => {}}
        storeError={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "还没有 Markdown 研究笔记" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "新建研究笔记" })[0]);
    expect(onNewNote).toHaveBeenCalledOnce();
  });
});
