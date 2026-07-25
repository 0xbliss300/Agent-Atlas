import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "./Header.jsx";

describe("Header", () => {
  it("工作台导航高亮并跳转到稳定路由", () => {
    const navigate = vi.fn();
    render(
      <Header
        navigate={navigate}
        activeNav="workbench"
        settingsOpen={false}
        onSettings={() => {}}
        onAdd={() => {}}
        addDisabled={false}
      />,
    );
    const link = screen.getByRole("button", { name: "开发工作台" });
    expect(link).toHaveAttribute("aria-current", "page");
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith("/workbench");
  });

  it("使用指南导航高亮并跳转到指南路由", () => {
    const navigate = vi.fn();
    render(
      <Header
        navigate={navigate}
        activeNav="guide"
        settingsOpen={false}
        onSettings={() => {}}
        onAdd={() => {}}
        addDisabled={false}
      />,
    );
    const link = screen.getByRole("button", { name: "使用指南" });
    expect(link).toHaveAttribute("aria-current", "page");
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith("/guide");
  });
});
