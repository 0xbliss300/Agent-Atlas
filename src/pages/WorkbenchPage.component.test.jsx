import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkbenchPage } from "./WorkbenchPage.jsx";

const activeProject = {
  id: "project-1",
  name: "知识库 Agent",
  status: "active",
  statusLabel: "开发中",
  milestone: "完成本地索引",
  updatedAt: "2026-07-25T10:00:00+08:00",
  updated: "2026-07-25",
  updatedTimestamp: Date.parse("2026-07-25T10:00:00+08:00"),
  blockers: [{ id: "blocker-1", title: "等待本地权限", done: false }],
  nextTasks: [
    { id: "task-1", title: "完成索引测试", done: false },
    { id: "task-2", title: "已完成接入", done: true },
  ],
  collectionIds: ["collection-focus"],
};

const staleProject = {
  ...activeProject,
  id: "project-2",
  name: "暂停 Agent",
  status: "paused",
  statusLabel: "已暂停",
  updatedAt: "2026-06-01T10:00:00+08:00",
  updated: "2026-06-01",
  updatedTimestamp: Date.parse("2026-06-01T10:00:00+08:00"),
  blockers: [],
  nextTasks: [],
  collectionIds: ["collection-later"],
};

const note = {
  id: "note-1",
  projectId: "project-1",
  title: "索引实验",
  body: "记录实验结论",
  updatedAt: "2026-07-25T12:00:00+08:00",
  updatedTimestamp: Date.parse("2026-07-25T12:00:00+08:00"),
};

function renderWorkbench(overrides = {}) {
  const props = {
    projects: [activeProject, staleProject],
    researchNotes: [note],
    navigate: vi.fn(),
    onAddProject: vi.fn(),
    onToggleTask: vi.fn(() => ({ ok: true, message: "任务已标记完成。" })),
    onResolveBlocker: vi.fn(() => ({ ok: true, message: "阻塞项已标记解决。" })),
    storeError: null,
    collections: [
      { id: "collection-focus", name: "当前重点" },
      { id: "collection-later", name: "稍后处理" },
    ],
    ...overrides,
  };
  render(<WorkbenchPage {...props} />);
  return props;
}

describe("WorkbenchPage", () => {
  it("展示派生统计、默认优先队列和停滞规则", () => {
    renderWorkbench();
    expect(screen.getByRole("heading", { name: "开发工作台" })).toBeInTheDocument();
    expect(screen.getByLabelText("工作台统计")).toHaveTextContent("任务总数2");
    expect(screen.getByLabelText("工作台统计")).toHaveTextContent("未解决阻塞1");
    expect(screen.getByText(/连续达到 14 天/)).toBeInTheDocument();
    const queue = screen.getByRole("heading", { name: "接下来做什么" }).parentElement.parentElement
      .parentElement;
    expect(queue).toHaveTextContent("等待本地权限");
    expect(queue).toHaveTextContent("完成索引测试");
    expect(queue).toHaveTextContent("可能停滞");
    expect(queue.textContent.indexOf("等待本地权限")).toBeLessThan(
      queue.textContent.indexOf("完成索引测试"),
    );
  });

  it("可用原生复选框更新任务、解决阻塞并播报反馈", () => {
    const props = renderWorkbench();
    const checkbox = screen.getByRole("checkbox", { name: "完成索引测试" });
    checkbox.focus();
    expect(checkbox).toHaveFocus();
    fireEvent.click(checkbox);
    expect(props.onToggleTask).toHaveBeenCalledWith("project-1", "task-1");
    expect(screen.getByRole("status")).toHaveTextContent("任务已标记完成");

    fireEvent.click(screen.getByRole("button", { name: "标记已解决" }));
    expect(props.onResolveBlocker).toHaveBeenCalledWith("project-1", "blocker-1");
    expect(screen.getByRole("status")).toHaveTextContent("阻塞项已标记解决");
  });

  it("按项目和类型筛选，任务类型包含已完成项以便取消勾选", () => {
    renderWorkbench();
    fireEvent.change(screen.getByLabelText("按内容类型筛选"), {
      target: { value: "task" },
    });
    expect(screen.getByRole("checkbox", { name: "已完成接入" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("按项目筛选"), {
      target: { value: "project-2" },
    });
    expect(screen.getByRole("heading", { name: "当前队列为空" })).toBeInTheDocument();
    expect(screen.getByText(/没有任务/)).toBeInTheDocument();
  });

  it("按集合缩小任务、阻塞与停滞项目范围并播报数量", () => {
    renderWorkbench();
    fireEvent.change(screen.getByLabelText("按集合筛选"), {
      target: { value: "collection-later" },
    });
    expect(screen.getByRole("heading", { name: "可能停滞" })).toBeInTheDocument();
    expect(screen.queryByText("等待本地权限")).not.toBeInTheDocument();
    expect(screen.getByText("当前显示 1 项")).toBeInTheDocument();
  });

  it("来源链接跳回准确项目或笔记", () => {
    const props = renderWorkbench();
    fireEvent.click(screen.getAllByRole("link", { name: "返回来源项目" })[0]);
    expect(props.navigate).toHaveBeenCalledWith("/project/project-1");
    fireEvent.change(screen.getByLabelText("按内容类型筛选"), {
      target: { value: "note" },
    });
    fireEvent.click(screen.getByRole("link", { name: "打开研究笔记" }));
    expect(props.navigate).toHaveBeenCalledWith("/notes/note-1");
  });

  it("无项目时提供明确创建入口", () => {
    const onAddProject = vi.fn();
    renderWorkbench({ projects: [], researchNotes: [], onAddProject });
    expect(screen.getByRole("heading", { name: "还没有可汇总的项目" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "添加第一个项目" }));
    expect(onAddProject).toHaveBeenCalledOnce();
  });
});
