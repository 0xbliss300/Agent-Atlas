import { ArrowRight, X } from "@phosphor-icons/react";

export function OnboardingTip({ title, body, onStart, onSkip }) {
  return (
    <aside className="onboarding-tip" role="note" aria-label={title}>
      <div className="onboarding-tip-body">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      <div className="onboarding-tip-actions">
        <button type="button" className="primary-button" onClick={onStart}>
          开始引导
          <ArrowRight size={16} weight="bold" />
        </button>
        <button
          type="button"
          className="icon-button onboarding-tip-dismiss"
          onClick={onSkip}
          aria-label="跳过引导"
        >
          <X size={18} />
        </button>
      </div>
    </aside>
  );
}
