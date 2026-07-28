import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), input:not(:disabled):not([type="file"]), select:not(:disabled), textarea:not(:disabled), summary, [href], [tabindex]:not([tabindex="-1"])';

// Stack of currently-mounted dialog panel refs. Only the topmost dialog
// responds to Esc/Tab so stacked dialogs (e.g. ConfirmDialog over
// SettingsPanel/ProjectFormPanel) don't double-handle keyboard events.
const dialogStack = [];

export function useDialogFocus(panelRef, initialFocusRef, requestClose) {
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const returnTarget = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      (initialFocusRef?.current ?? panelRef.current)?.focus();
    }, 0);

    dialogStack.push(panelRef);

    const handleKeyDown = (event) => {
      if (dialogStack[dialogStack.length - 1] !== panelRef) return;

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
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      const index = dialogStack.indexOf(panelRef);
      if (index !== -1) dialogStack.splice(index, 1);
      if (returnTarget instanceof HTMLElement) {
        window.setTimeout(() => returnTarget.focus(), 0);
      }
    };
  }, []);
}
