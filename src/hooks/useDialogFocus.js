import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])';

export function useDialogFocus(panelRef, initialFocusRef, requestClose) {
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const returnTarget = document.activeElement;
    window.setTimeout(() => (initialFocusRef.current ?? panelRef.current)?.focus(), 0);

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (returnTarget instanceof HTMLElement) {
        window.setTimeout(() => returnTarget.focus(), 0);
      }
    };
  }, []);
}
