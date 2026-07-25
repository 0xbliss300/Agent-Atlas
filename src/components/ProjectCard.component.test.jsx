import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotFoundPage } from "../pages/NotFoundPage.jsx";
import { ProjectCard } from "./ProjectCard.jsx";

const project = {
  id: "project-1",
  name: "知识库 Agent",
  short: "整理本地研究资料",
  statusLabel: "开发中",
  statusTone: "active",
  progress: 60,
  progressValid: true,
  milestone: "完成检索闭环",
  updated: "2026-07-10",
  iconKey: "showcase",
  tags: ["Agent", "本地优先", "研究", "知识库"],
  pinned: true,
};

describe("ProjectCard", () => {
  it("提供单一项目链接、状态名称和可读进度", () => {
    render(<ProjectCard project={project} onOpen={() => {}} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /查看项目：知识库 Agent/ })).toBeInTheDocument();
    expect(screen.getByLabelText("项目状态：开发中")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
  });

  it("支持点击和 Space 键打开项目", () => {
    const onOpen = vi.fn();
    render(<ProjectCard project={project} onOpen={onOpen} />);
    const link = screen.getByRole("link");

    fireEvent.click(link);
    fireEvent.keyDown(link, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("克制展示有限标签并提供可聚焦的置顶切换按钮", () => {
    const onTogglePin = vi.fn();
    render(<ProjectCard project={project} onOpen={() => {}} onTogglePin={onTogglePin} />);
    expect(screen.getByLabelText(/项目标签/)).toHaveTextContent("Agent");
    expect(screen.getByLabelText(/项目标签/)).toHaveTextContent("+1");
    const pinButton = screen.getByRole("button", { name: "取消置顶知识库 Agent" });
    pinButton.focus();
    expect(pinButton).toHaveFocus();
    expect(pinButton).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(pinButton);
    expect(onTogglePin).toHaveBeenCalledWith("project-1", false);
  });
});

describe("NotFoundPage", () => {
  it("缺失项目提供明确提示和返回入口", () => {
    const navigate = vi.fn();
    render(<NotFoundPage projectMissing navigate={navigate} />);

    expect(screen.getByRole("heading", { name: "项目不存在" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /返回项目概览/ }));
    expect(navigate).toHaveBeenCalledWith("/");
  });
});
