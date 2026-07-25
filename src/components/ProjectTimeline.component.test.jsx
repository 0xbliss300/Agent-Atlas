import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { normalizeProjectEvent } from "../data/projectEvents.js";
import { ProjectTimeline } from "./ProjectTimeline.jsx";

function event(overrides = {}) {
  return normalizeProjectEvent({
    id: "event-1",
    projectId: "project-1",
    type: "status",
    occurredAt: "2026-07-25T12:00:00+08:00",
    summary: "更新项目状态：完成度",
    changes: [{ field: "progress", label: "完成度", before: "20%", after: "50%" }],
    ...overrides,
  });
}

describe("ProjectTimeline", () => {
  it("按时间倒序展示事件并支持类型筛选和结果播报", () => {
    const events = [
      event(),
      event({
        id: "event-2",
        type: "task",
        occurredAt: "2026-07-25T13:00:00+08:00",
        summary: "完成任务“补齐测试”",
        changes: [],
      }),
    ];
    render(<ProjectTimeline projectId="project-1" events={events} />);
    const timeline = screen.getByRole("list");
    expect(timeline.textContent.indexOf("完成任务")).toBeLessThan(
      timeline.textContent.indexOf("更新项目状态"),
    );
    fireEvent.change(screen.getByLabelText("筛选变更事件类型"), {
      target: { value: "task" },
    });
    expect(screen.getByText("完成任务“补齐测试”")).toBeInTheDocument();
    expect(screen.queryByText("更新项目状态：完成度")).not.toBeInTheDocument();
    expect(screen.getByText("当前显示 1 条")).toHaveAttribute("aria-live", "polite");
  });

  it("可跳转到现存笔记，来源删除后只显示标记", () => {
    const navigate = vi.fn();
    const noteEvent = event({
      id: "note-event",
      type: "note",
      summary: "创建研究笔记“实验”",
      changes: [],
      subject: {
        kind: "note",
        id: "note-1",
        title: "实验",
        action: "created",
        sourceDeleted: false,
      },
    });
    const { rerender } = render(
      <ProjectTimeline projectId="project-1" events={[noteEvent]} navigate={navigate} />,
    );
    fireEvent.click(screen.getByRole("link", { name: "打开来源笔记" }));
    expect(navigate).toHaveBeenCalledWith("/notes/note-1");

    rerender(
      <ProjectTimeline
        projectId="project-1"
        events={[
          normalizeProjectEvent({
            ...noteEvent,
            subject: { ...noteEvent.subject, sourceDeleted: true },
          }),
        ]}
        navigate={navigate}
      />,
    );
    expect(screen.getByText("来源笔记已删除")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "打开来源笔记" })).not.toBeInTheDocument();
  });

  it("无事件、筛选无结果和存储损坏均有明确状态", () => {
    const { rerender } = render(<ProjectTimeline projectId="project-1" events={[]} />);
    expect(screen.getByRole("heading", { name: "尚无自动变更事件" })).toBeInTheDocument();

    rerender(
      <ProjectTimeline projectId="project-1" events={[event()]} storeError="时间线无法读取" />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("时间线无法读取");
  });
});
