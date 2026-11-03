"use client";

import { useEffect } from "react";
import { warmShell } from "@/lib/offline/download";

/** Production only. `next dev` stays free of a worker so hot reload isn't served from an old cache. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    void warmShell();
  }, []);
  return null;
}
