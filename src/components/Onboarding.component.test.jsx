import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Onboarding } from "./Onboarding.jsx";
import { OnboardingTip } from "./OnboardingTip.jsx";

function renderOnboarding(overrides = {}) {
  const onComplete = vi.fn();
  const onSkip = vi.fn();
  const onAdd = vi.fn();
  const navigate = vi.fn();
  render(
    <Onboarding
      open
      onComplete={onComplete}
      onSkip={onSkip}
      onAdd={onAdd}
      navigate={navigate}
      {...overrides}
    />,
  );
  return { onComplete, onSkip, onAdd, navigate };
}

describe("Onboarding 首次使用引导", () => {
  it("open 为 false 时不渲染", () => {
    render(<Onboarding open={false} onComplete={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("首步显示欢迎内容并可推进到添加项目步骤", () => {
    renderOnboarding();
    expect(screen.getByRole("heading", { name: "欢迎使用 Agent Atlas" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始引导" }));
    expect(screen.getByRole("heading", { name: "添加第一个项目" })).toBeInTheDocument();
  });

  it("从本地目录导入触发 onAdd 与 onComplete", () => {
    const { onAdd, onComplete } = renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "开始引导" }));
    fireEvent.click(screen.getByRole("button", { name: /从本地目录导入/ }));
    expect(onAdd).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it("跳过引导触发 onSkip", () => {
    const { onSkip } = renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "跳过引导" }));
    expect(onSkip).toHaveBeenCalled();
  });

  it("Esc 触发 onSkip", () => {
    const { onSkip } = renderOnboarding();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onSkip).toHaveBeenCalled();
  });

  it("推进到了解入口步骤后完成引导触发 onComplete", () => {
    const { onComplete } = renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "开始引导" }));
    fireEvent.click(screen.getByRole("button", { name: "稍后再说，继续了解" }));
    expect(screen.getByRole("heading", { name: "了解主要入口" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "完成引导" }));
    expect(onComplete).toHaveBeenCalled();
  });

  it("了解入口步骤可跳转到工作台并完成引导", () => {
    const { navigate, onComplete } = renderOnboarding();
    fireEvent.click(screen.getByRole("button", { name: "开始引导" }));
    fireEvent.click(screen.getByRole("button", { name: "稍后再说，继续了解" }));
    fireEvent.click(screen.getByRole("button", { name: "前往工作台" }));
    expect(navigate).toHaveBeenCalledWith("/workbench");
    expect(onComplete).toHaveBeenCalled();
  });
});

describe("OnboardingTip 轻量提示", () => {
  it("渲染标题与正文并可开始或跳过", () => {
    const onStart = vi.fn();
    const onSkip = vi.fn();
    render(
      <OnboardingTip
        title="首次使用工作台"
        body="先添加项目再回来。"
        onStart={onStart}
        onSkip={onSkip}
      />,
    );
    expect(screen.getByText("首次使用工作台")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /开始引导/ }));
    expect(onStart).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "跳过引导" }));
    expect(onSkip).toHaveBeenCalled();
  });
});
