import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverviewPage } from "./OverviewPage.jsx";
import { ProjectDetailPage } from "./ProjectDetailPage.jsx";

const project = {
  id: "project-1",
  name: "知识库 Agent",
  short: "整理本地研究资料",
  description: "本地优先的研究资料助手",
  status: "active",
  statusLabel: "开发中",
  statusTone: "active",
  progress: 60,
  progressValid: true,
  milestone: "完成检索闭环",
  updated: "2026-07-25",
  updatedTime: "12:00",
  iconKey: "showcase",
  localPath: null,
  repositoryUrl: null,
  documentationPath: null,
  demoUrl: null,
  previewPath: null,
  features: [],
  roadmap: [],
  log: [],
  blockers: [{ id: "blocker-1", title: "等待模型评估", done: false }],
  nextTasks: [{ id: "task-1", title: "完成任务清单", done: false }],
  technology: {
    languages: ["JavaScript"],
    frameworks: ["React"],
    models: ["GPT-5"],
    dataSources: ["Markdown"],
    runCommand: "npm run dev",
  },
  localSync: null,
};

describe("P2 项目增强", () => {
  it("概览页搜索、状态筛选和排序控件会回传选择", () => {
    const onQueryChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onSortChange = vi.fn();
    render(
      <OverviewPage
        projects={[project]}
        visibleProjects={[]}
        summary={{ total: 1, active: 1, done: 0 }}
        recentProjects={[project]}
        showRecent={false}
        notesMode={false}
        onAdd={() => {}}
        onOpenSettings={() => {}}
        navigate={() => {}}
        storeError={null}
        query=""
        statusFilter="all"
        sortBy="updated"
        onQueryChange={onQueryChange}
        onStatusFilterChange={onStatusFilterChange}
        onSortChange={onSortChange}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox", { name: "搜索项目" }), {
      target: { value: "React" },
    });
    fireEvent.change(screen.getByLabelText("状态"), { target: { value: "active" } });
    fireEvent.change(screen.getByLabelText("排序"), { target: { value: "progress" } });
    expect(onQueryChange).toHaveBeenCalledWith("React");
    expect(onStatusFilterChange).toHaveBeenCalledWith("active");
    expect(onSortChange).toHaveBeenCalledWith("progress");
  });

  it("详情页展示阻塞、技术信息并允许勾选任务和打开本地读取", () => {
    const onToggleTask = vi.fn();
    const onOpenSync = vi.fn();
    const onOpenCodexContext = vi.fn();
    render(
      <ProjectDetailPage
        project={project}
        notesMode={false}
        navigate={() => {}}
        onEdit={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
        onToggleTask={onToggleTask}
        onOpenSync={onOpenSync}
        onOpenCodexContext={onOpenCodexContext}
      />,
    );
    expect(screen.getByText("等待模型评估")).toBeInTheDocument();
    expect(screen.getByText("GPT-5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /完成任务清单/ }));
    fireEvent.click(screen.getByRole("button", { name: "读取本地状态" }));
    fireEvent.click(screen.getByRole("button", { name: "生成 Codex 上下文" }));
    expect(onToggleTask).toHaveBeenCalledWith("task-1");
    expect(onOpenSync).toHaveBeenCalledOnce();
    expect(onOpenCodexContext).toHaveBeenCalledOnce();
  });
});
