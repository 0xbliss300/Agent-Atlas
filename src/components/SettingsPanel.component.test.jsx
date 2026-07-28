import { fireEvent, render, screen } from "@testing-library/react";
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
