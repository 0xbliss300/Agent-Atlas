import { useEffect, useRef, useState } from "react";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

const SUCCESS_DURATION = 3000;
const EXIT_DURATION = 300;

export function Toast({ message = "", type = "success", enabled = true, onClose }) {
  const [visible, setVisible] = useState(false);
  const enterTimerRef = useRef(null);
  const exitTimerRef = useRef(null);

  useEffect(() => {
    setVisible(true);
    if (type !== "error") {
      enterTimerRef.current = window.setTimeout(() => setVisible(false), SUCCESS_DURATION);
    }
    return () => {
      if (enterTimerRef.current) {
        window.clearTimeout(enterTimerRef.current);
      }
    };
  }, [type]);

  useEffect(() => {
    if (!visible) {
      exitTimerRef.current = window.setTimeout(() => onClose?.(), EXIT_DURATION);
      return () => {
        if (exitTimerRef.current) {
          window.clearTimeout(exitTimerRef.current);
        }
      };
    }
    if (exitTimerRef.current) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    return undefined;
  }, [visible, onClose]);

  useEffect(() => {
    if (!enabled || !visible) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setVisible(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, visible]);

  if (!message) return null;

  return (
    <div
      className={`toast toast-${type} ${visible ? "is-visible" : "is-hiding"}`}
      role={type === "error" ? "alert" : "status"}
      aria-atomic="true"
    >
      {type === "error" ? (
        <WarningCircle size={20} aria-hidden="true" className="toast-icon" />
      ) : (
        <CheckCircle size={20} aria-hidden="true" className="toast-icon" />
      )}
      <span className="toast-message">{message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={() => setVisible(false)}
        aria-label="关闭通知"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
