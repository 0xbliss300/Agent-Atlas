import { useEffect, useState } from "react";
import { normalizeRoutePath } from "../routing.js";

function readRoutePath() {
  return normalizeRoutePath(window.location.hash || window.location.pathname);
}

export function useRoute() {
  const [path, setPath] = useState(readRoutePath);

  useEffect(() => {
    if (!window.location.hash) {
      const initialPath = normalizeRoutePath(window.location.pathname);
      window.history.replaceState({}, "", "/#" + initialPath);
      setPath(initialPath);
    }

    const handleRouteChange = () => setPath(readRoutePath());
    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("hashchange", handleRouteChange);

    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("hashchange", handleRouteChange);
    };
  }, []);

  const navigate = (next) => {
    const normalized = normalizeRoutePath(next);
    window.history.pushState({}, "", "/#" + normalized);
    setPath(normalized);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return [path, navigate];
}
