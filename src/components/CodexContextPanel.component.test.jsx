import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodexContextPanel } from "./CodexContextPanel.jsx";

const project = {
  name: "知识库 Agent",
  short: "整理资料",
  description: "本地研究助手",
  statusLabel: "开发中",
  progress: 60,
  milestone: "完成检索闭环",
  updatedAt: "2026-07-25T12:00:00+08:00",
  blockers: [{ title: "等待评估", done: false }],
  nextTasks: [{ title: "完成测试", done: false }],
  technology: {
    languages: ["JavaScript"],
    frameworks: ["React"],
    models: [],
    dataSources: ["Markdown"],
    runCommand: "npm run dev",
  },
  log: ["建立生成流程"],
};

const notes = [1, 2, 3, 4].map((index) => ({
  id: `note-${index}`,
  title: `研究笔记 ${index}`,
  body: `## 笔记正文 ${index}`,
  updated: `2026-07-2${index}`,
  updatedTime: "12:00",
  updatedAt: `2026-07-2${index}T12:00:00+08:00`,
  updatedTimestamp: Date.parse(`2026-07-2${index}T12:00:00+08:00`),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CodexContextPanel", () => {
  it("默认选择最近三篇并实时更新笔记数、字符数和预览", () => {
    render(<CodexContextPanel project={project} researchNotes={notes} onClose={() => {}} />);
    expect(screen.getByText("3 篇")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /研究笔记 1/ })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /研究笔记 4/ })).toBeChecked();
    expect(screen.getByLabelText("Codex 上下文 Markdown 预览")).toHaveTextContent("## 1. 项目目标");
    fireEvent.click(screen.getByRole("checkbox", { name: /研究笔记 4/ }));
    expect(screen.getByText("2 篇")).toBeInTheDocument();
    expect(screen.getByText("字符数").nextElementSibling).not.toHaveTextContent("0");
  });

  it("未选择笔记仍可生成并复制成功", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(<CodexContextPanel project={project} researchNotes={[]} onClose={() => {}} />);
    expect(screen.getByText("0 篇")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "复制 Markdown" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toContain("未选择研究笔记");
    expect(screen.getByText("Markdown 已复制到剪贴板。")).toBeInTheDocument();
  });

  it("复制失败时显示反馈", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    render(<CodexContextPanel project={project} researchNotes={[]} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "复制 Markdown" }));
    expect(
      await screen.findByText("复制失败，请检查浏览器的剪贴板权限后重试。"),
    ).toBeInTheDocument();
  });

  it("下载 Markdown 使用安全文件名和正确 MIME", () => {
    const createObjectURL = vi.fn(() => "blob:context");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi
      .spyOn(window.HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    render(
      <CodexContextPanel
        project={{ ...project, name: "知识库/A:B" }}
        researchNotes={[]}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "下载 .md" }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL.mock.calls[0][0].type).toBe("text/markdown;charset=utf-8");
    expect(click).toHaveBeenCalledOnce();
    expect(screen.getByText(/已下载 知识库-A-B-CODEX_CONTEXT\.md/)).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:context");
  });
});
