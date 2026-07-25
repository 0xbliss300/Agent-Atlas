import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserGuidePage } from "./UserGuidePage.jsx";

const guideMarkdown = `
> 本指南只说明当前功能。

## 快速开始

选择“添加项目”录入真实内容。

## 本地数据与安全边界

数据保存在当前浏览器。
`;

describe("UserGuidePage", () => {
  it("加载 Markdown、渲染关键章节并通过目录把焦点移到正文标题", async () => {
    render(<UserGuidePage navigate={() => {}} loadMarkdown={() => guideMarkdown} />);

    expect(screen.getByRole("status")).toHaveTextContent("正在载入本地使用指南");
    expect(await screen.findByRole("heading", { name: "快速开始" })).toHaveAttribute(
      "id",
      "guide-快速开始",
    );
    expect(screen.getByText("选择“添加项目”录入真实内容。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /本地数据与安全边界/ }));
    const heading = screen.getByRole("heading", { name: "本地数据与安全边界" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("已跳转到“本地数据与安全边界”。")).toBeInTheDocument();
  });

  it("Markdown 继续阻止危险 HTML、URL 和远程图片", async () => {
    const markdown =
      "## 安全\n\n<script>alert(1)</script>\n[危险](javascript:alert(1))\n[外部](https://example.com)\n![追踪](https://example.com/x.png)";
    const { container } = render(
      <UserGuidePage navigate={() => {}} loadMarkdown={() => markdown} />,
    );

    await screen.findByRole("heading", { name: "安全" });
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("危险").closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "外部" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByText("[远程图片已禁用]")).toBeInTheDocument();
  });

  it("指南读取失败时显示错误状态并可返回概览", async () => {
    const navigate = vi.fn();
    render(
      <UserGuidePage
        navigate={navigate}
        loadMarkdown={() => Promise.reject(new Error("missing"))}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "使用指南暂时无法载入" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "返回项目概览" }));
    expect(navigate).toHaveBeenCalledWith("/");
  });
});
