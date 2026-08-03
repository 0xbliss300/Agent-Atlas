import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel.jsx";

const baseProps = {
  close: vi.fn(),
  projects: [],
  researchNotes: [],
  projectEvents: [],
  templates: [],
  collections: [],
  collectionStoreError: "",
  storeError: "",
  settings: {
    showCompleted: true,
    sortBy: "updated",
    density: "standard",
    showRecent: true,
    enableShortcuts: true,
    onboardingState: "completed",
    theme: "system",
  },
  settingsError: "",
  onSettingsChange: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onReset: vi.fn(),
  onRestartOnboarding: vi.fn(),
  onCreateCollection: vi.fn(),
  onRenameCollection: vi.fn(),
  onMoveCollection: vi.fn(),
  onDeleteCollection: vi.fn(),
};

describe("SettingsPanel 首次使用引导入口", () => {
  it("引导已完成时可点击重新启动按钮", () => {
    const onRestartOnboarding = vi.fn();
    render(<SettingsPanel {...baseProps} onRestartOnboarding={onRestartOnboarding} />);
    fireEvent.click(screen.getByRole("button", { name: "重新启动首次使用引导" }));
    expect(onRestartOnboarding).toHaveBeenCalled();
  });

  it("引导仍为 pending 时禁用重新启动按钮", () => {
    render(
      <SettingsPanel
        {...baseProps}
        settings={{ ...baseProps.settings, onboardingState: "pending" }}
      />,
    );
    expect(screen.getByRole("button", { name: "重新启动首次使用引导" })).toBeDisabled();
  });
});

describe("SettingsPanel 应用版本展示", () => {
  it("传入 version 时显示 v 前缀版本号", () => {
    render(<SettingsPanel {...baseProps} version="0.1.0" />);
    expect(screen.getByText("应用版本")).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("未传入 version 时显示未配置", () => {
    render(<SettingsPanel {...baseProps} />);
    expect(screen.getByText("应用版本")).toBeInTheDocument();
    expect(screen.getByText("未配置")).toBeInTheDocument();
  });
});

describe("SettingsPanel 主题选择", () => {
  it("显示主题下拉并包含跟随系统/浅色/暗色三个选项", () => {
    render(<SettingsPanel {...baseProps} />);
    const select = screen.getByRole("combobox", { name: "主题" });
    expect(select).toBeInTheDocument();
    const options = within(select).getAllByRole("option");
    expect(options.map((opt) => opt.textContent)).toEqual(["跟随系统", "浅色", "暗色"]);
  });

  it("默认选中跟随系统", () => {
    render(<SettingsPanel {...baseProps} />);
    const select = screen.getByRole("combobox", { name: "主题" });
    expect(select.value).toBe("system");
  });

  it("切换为暗色时调用 onSettingsChange 并传入 theme=dark", () => {
    const onSettingsChange = vi.fn();
    render(<SettingsPanel {...baseProps} onSettingsChange={onSettingsChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "主题" }), {
      target: { value: "dark" },
    });
    expect(onSettingsChange).toHaveBeenCalledWith({ theme: "dark" });
  });

  it("settings.theme 为 dark 时下拉选中暗色", () => {
    render(<SettingsPanel {...baseProps} settings={{ ...baseProps.settings, theme: "dark" }} />);
    expect(screen.getByRole("combobox", { name: "主题" }).value).toBe("dark");
  });

  it("settings 缺少 theme 字段时回退为跟随系统", () => {
    const settingsWithoutTheme = {
      showCompleted: true,
      sortBy: "updated",
      density: "standard",
      showRecent: true,
      enableShortcuts: true,
      onboardingState: "completed",
    };
    render(<SettingsPanel {...baseProps} settings={settingsWithoutTheme} />);
    expect(screen.getByRole("combobox", { name: "主题" }).value).toBe("system");
  });
});
