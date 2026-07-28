import { useEffect, useRef, useState } from "react";
import { ArrowRight, FolderOpen, NotePencil, Plus, X } from "@phosphor-icons/react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

const STEP_KEYS = ["welcome", "add", "explore"];

export function Onboarding({ open, onComplete, onSkip, onAdd, navigate }) {
  const panelRef = useRef(null);
  const [step, setStep] = useState(0);
  useDialogFocus(panelRef, null, onSkip);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const finishWithProject = () => {
    onComplete();
    onAdd();
  };

  const goTo = (path) => {
    onComplete();
    navigate(path);
  };

  return (
    <div className="scrim" onMouseDown={onSkip} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className="onboarding-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="onboarding-head">
          <p className="eyebrow">FIRST-RUN GUIDE</p>
          <h2 id="onboarding-title">欢迎使用 Agent Atlas</h2>
          <button
            type="button"
            className="icon-button onboarding-skip"
            onClick={onSkip}
            aria-label="关闭并跳过引导"
          >
            <X size={20} />
          </button>
        </div>

        <ol className="onboarding-steps" aria-label="引导步骤">
          {STEP_KEYS.map((key, index) => (
            <li
              key={key}
              className={`onboarding-step-indicator ${index === step ? "is-current" : ""} ${
                index < step ? "is-done" : ""
              }`}
            >
              <span>{index + 1}</span>
            </li>
          ))}
        </ol>

        {step === 0 ? (
          <div className="onboarding-body">
            <p>
              Agent Atlas 在本地记录你的 Agent 项目、研究笔记与开发历史。这里没有演示数据，
              跟随三步即可建立第一个项目，并了解主要入口。
            </p>
            <ul className="onboarding-tasks">
              <li>
                <Plus size={18} aria-hidden="true" />
                <span>添加或导入第一个项目</span>
              </li>
              <li>
                <ArrowRight size={18} aria-hidden="true" />
                <span>用工作台汇总跨项目任务与阻塞</span>
              </li>
              <li>
                <NotePencil size={18} aria-hidden="true" />
                <span>为项目撰写 Markdown 研究笔记</span>
              </li>
            </ul>
            <div className="onboarding-actions">
              <button type="button" className="primary-button" onClick={() => setStep(1)}>
                开始引导
              </button>
              <button type="button" className="secondary-button" onClick={onSkip}>
                跳过引导
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onboarding-body">
            <h3>添加第一个项目</h3>
            <p>
              推荐从本地目录生成草稿：选择项目目录后，应用只读取白名单文件并生成可编辑草稿，
              你确认后再保存。也可以手动填写项目名称、状态和里程碑。
            </p>
            <div className="onboarding-actions">
              <button type="button" className="primary-button" onClick={finishWithProject}>
                <FolderOpen size={18} weight="bold" />
                从本地目录导入
              </button>
              <button type="button" className="secondary-button" onClick={finishWithProject}>
                <Plus size={18} weight="bold" />
                手动创建项目
              </button>
              <button type="button" className="text-button" onClick={() => setStep(2)}>
                稍后再说，继续了解
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onboarding-body">
            <h3>了解主要入口</h3>
            <p>
              <strong>开发工作台</strong>会从现有项目派生执行队列，集中未解决阻塞与待办任务；
              <strong>研究笔记</strong>按项目沉淀 Markdown 文档，与简短开发记录分开保存。
            </p>
            <div className="onboarding-actions">
              <button type="button" className="secondary-button" onClick={() => goTo("/workbench")}>
                前往工作台
              </button>
              <button type="button" className="secondary-button" onClick={() => goTo("/notes")}>
                查看研究笔记
              </button>
              <button type="button" className="primary-button" onClick={onComplete}>
                完成引导
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
