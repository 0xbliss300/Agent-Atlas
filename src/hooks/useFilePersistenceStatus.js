import { useSyncExternalStore } from "react";
import { getFilePersistenceStatus, subscribeFilePersistence } from "../data/filePersistence.js";

export function useFilePersistenceStatus() {
  return useSyncExternalStore(
    subscribeFilePersistence,
    getFilePersistenceStatus,
    getFilePersistenceStatus,
  );
}
