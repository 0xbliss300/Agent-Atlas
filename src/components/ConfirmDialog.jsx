import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

// 两个 Context 分离：使用 confirm 函数的组件不会因为 isOpen 变化而重渲染，
// 只有需要感知 isOpen 的组件（App 用于禁用 Toast Esc）才订阅 ConfirmOpenContext。
const ConfirmFnContext = createContext(() => Promise.resolve(false));
const ConfirmOpenContext = createContext(false);

export function ConfirmDialog({
  title,
  message,
  detail,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const panelRef = useRef(null);
  const cancelBtnRef = useRef(null);
  const confirmBtnRef = useRef(null);
  // 危险操作初始焦点落在 Cancel（防误触），非危险落在 Confirm。
  const initialFocusRef = danger ? cancelBtnRef : confirmBtnRef;
  useDialogFocus(panelRef, initialFocusRef, onCancel);

  return (
    <div className="confirm-scrim" onMouseDown={onCancel} role="presentation">
      <section
        ref={panelRef}
        tabIndex="-1"
        className={"confirm-dialog" + (danger ? " is-danger" : "")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="confirm-head">
          <p className="eyebrow">{danger ? "CONFIRM ACTION" : "PLEASE CONFIRM"}</p>
          <h2 id="confirm-title">{title}</h2>
        </div>
        <p id="confirm-message" className="confirm-message">
          {message}
        </p>
        {detail && <p className="confirm-detail">{detail}</p>}
        <div className="confirm-actions">
          <button ref={cancelBtnRef} type="button" className="secondary-button" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={danger ? "danger-button" : "primary-button"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);

  const confirm = useCallback((options) => {
    // 已有对话框打开时拒绝嵌套调用，避免堆叠场景下 Esc 触发下层时再次打开新对话框。
    if (stateRef.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      stateRef.current = { ...options, resolver: resolve };
      setState(stateRef.current);
    });
  }, []);

  const close = useCallback((result) => {
    const prev = stateRef.current;
    stateRef.current = null;
    setState(null);
    prev?.resolver?.(result);
  }, []);

  const isOpen = state !== null;

  return (
    <ConfirmFnContext.Provider value={confirm}>
      <ConfirmOpenContext.Provider value={isOpen}>
        {children}
        {state && (
          <ConfirmDialog
            title={state.title}
            message={state.message}
            detail={state.detail}
            confirmText={state.confirmText}
            cancelText={state.cancelText}
            danger={state.danger}
            onConfirm={() => close(true)}
            onCancel={() => close(false)}
          />
        )}
      </ConfirmOpenContext.Provider>
    </ConfirmFnContext.Provider>
  );
}

export const useConfirmDialog = () => useContext(ConfirmFnContext);
export const useConfirmDialogOpen = () => useContext(ConfirmOpenContext);
