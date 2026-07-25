import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getBuiltinProjectTemplates } from "../data/templates.js";
import { ProjectFormPanel } from "./ProjectFormPanel.jsx";
import { TemplateWorkspace } from "./TemplateWorkspace.jsx";

describe("TemplateWorkspace", () => {
  it("套用模板只更新可编辑项目草稿，取消时不会创建项目", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    const templates = getBuiltinProjectTemplates();
    render(
      <ProjectFormPanel
        existingProjects={[]}
        templates={templates}
        onCreateTemplate={(action, template, draft) => {
          if (action !== "apply") return { ok: true };
          return {
            ok: true,
            draft: {
              ...draft,
              ...template.content,
            },
          };
        }}
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: /选择起始模板/ }), {
      target: { value: "builtin-project-agent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "套用默认模板" }));
    const description = screen.getByLabelText("完整介绍");
    expect(description.value).toContain("项目目标");
    fireEvent.change(description, { target: { value: "用户编辑后的结构" } });
    expect(description.value).toBe("用户编辑后的结构");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "关闭添加项目" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("自定义模板管理操作均可通过键盘可见按钮触发", () => {
    const custom = {
      id: "custom-note-1",
      type: "note",
      name: "团队大纲",
      description: "自定义 Markdown 大纲",
      builtin: false,
      order: 0,
      content: { title: "", body: "# 大纲" },
    };
    const onRename = vi.fn(() => ({ ok: true }));
    const onDuplicate = vi.fn(() => ({ ok: true }));
    const onMove = vi.fn(() => ({ ok: true }));
    const onDelete = vi.fn(() => ({ ok: true }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <TemplateWorkspace
        type="note"
        templates={[
          {
            id: "builtin-note-blank",
            type: "note",
            name: "空白笔记",
            description: "空白",
            builtin: true,
            content: {},
          },
          custom,
          { ...custom, id: "custom-note-2", name: "第二大纲", order: 1 },
        ]}
        onRename={onRename}
        onDuplicate={onDuplicate}
        onMove={onMove}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByText("管理自定义模板（2）"));
    fireEvent.click(screen.getByRole("button", { name: "重命名团队大纲" }));
    fireEvent.change(screen.getByLabelText("重命名团队大纲"), {
      target: { value: "新大纲" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onRename).toHaveBeenCalledWith("custom-note-1", "新大纲");

    fireEvent.click(screen.getByRole("button", { name: "复制团队大纲" }));
    fireEvent.click(screen.getByRole("button", { name: "下移团队大纲" }));
    fireEvent.click(screen.getByRole("button", { name: "删除团队大纲" }));
    expect(onDuplicate).toHaveBeenCalledWith("custom-note-1");
    expect(onMove).toHaveBeenCalledWith("custom-note-1", 1);
    expect(onDelete).toHaveBeenCalledWith("custom-note-1");
  });
});
