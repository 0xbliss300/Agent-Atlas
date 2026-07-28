import { useEffect, useRef } from "react";

const PREFIX_TIMEOUT = 800;

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable ||
    target.getAttribute("role") === "combobox"
  );
}

export function useKeyboardShortcuts({
  enabled,
  onOpenPalette,
  onOpenHelp,
  onFocusSearch,
  onNewProject,
  navigate,
}) {
  const handlersRef = useRef({ onOpenPalette, onOpenHelp, onFocusSearch, onNewProject, navigate });
  handlersRef.current = { onOpenPalette, onOpenHelp, onFocusSearch, onNewProject, navigate };
  const prefixRef = useRef(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const clearPrefix = () => {
      prefixRef.current = false;
    };
    let prefixTimer = null;

    const handleKeyDown = (event) => {
      const handlers = handlersRef.current;
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        clearPrefix();
        handlers.onOpenPalette?.();
        return;
      }
      if (isEditableTarget(event.target)) return;

      if (event.key === "?") {
        event.preventDefault();
        clearPrefix();
        handlers.onOpenHelp?.();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        clearPrefix();
        handlers.onFocusSearch?.();
        return;
      }
      if (prefixRef.current) {
        window.clearTimeout(prefixTimer);
        prefixRef.current = false;
        if (event.key === "w" || event.key === "W") {
          event.preventDefault();
          handlers.navigate?.("/workbench");
          return;
        }
        if (event.key === "n" || event.key === "N") {
          event.preventDefault();
          handlers.navigate?.("/notes");
          return;
        }
      }
      if (event.key === "g" || event.key === "G") {
        event.preventDefault();
        prefixRef.current = true;
        window.clearTimeout(prefixTimer);
        prefixTimer = window.setTimeout(clearPrefix, PREFIX_TIMEOUT);
        return;
      }
      if (event.key === "n" || event.key === "N") {
        event.preventDefault();
        clearPrefix();
        handlers.onNewProject?.();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(prefixTimer);
    };
  }, [enabled]);
}
