"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** In dev, refresh the server render when a file under content/ changes. */
export function ContentHotReload() {
  const router = useRouter();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const source = new EventSource("/api/dev/content");
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.onmessage = (event) => {
      if (event.data !== "reload") return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 80);
    };
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);
  return null;
}
