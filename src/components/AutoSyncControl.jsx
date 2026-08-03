import { ArrowsClockwise, ShieldCheck, StopCircle } from "@phosphor-icons/react";

export function AutoSyncControl({ isWatching, lastError = "", onStart, onStop, supported = true }) {
  return (
    <div className="detail-block sync-block">
      <div className="block-heading">
        <div>
          <p className="eyebrow">AUTO SYNC</p>
          <h2>自动状态同步</h2>
        </div>
        <ArrowsClockwise size={24} />
      </div>
      <p>
        开启后只读监听你授权的项目目录，在 Git 提交或关键文件改动时自动刷新项目状态并记录自动事件。
        目录句柄仅保存在当前会话内存中，刷新页面后需重新授权。
      </p>
      <div className="local-safety">
        <ShieldCheck size={23} weight="duotone" />
        <p>
          仅监听你明确选择的目录；不上传任何文件内容；可随时关闭并清理监听。自动事件在时间线中标记为“自动”。
        </p>
      </div>
      {!supported ? (
        <p className="inline-empty">
          当前浏览器不支持目录监听（需要 FileSystemObserver 或定时器）。
        </p>
      ) : isWatching ? (
        <div>
          <p className="inline-empty" style={{ color: "var(--green)" }}>
            正在监听目录变更…
          </p>
          <button className="secondary-button sync-button" type="button" onClick={onStop}>
            <StopCircle size={18} />
            停止自动同步
          </button>
        </div>
      ) : (
        <button className="primary-button sync-button" type="button" onClick={onStart}>
          <ArrowsClockwise size={18} />
          开启自动同步
        </button>
      )}
      {lastError && (
        <p className="form-submit-error" role="alert" style={{ marginTop: 8 }}>
          {lastError}
        </p>
      )}
    </div>
  );
}
