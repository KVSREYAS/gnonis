"use client";

import { useEffect } from "react";
import { useOnline } from "@/lib/offline/use-online";

/**
 * App Router clicks fetch an RSC payload, which we don't cache (the payload depends on
 * router headers that change per click). A full load is a navigation the service worker
 * can answer from the saved HTML.
 */
export function OfflineNavigation() {
  const online = useOnline();
  useEffect(() => {
    if (online) return;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        return;
      }
      if (url.origin !== location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      // A full load, not a client transition: the service worker can only answer document requests.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign(`${url.pathname}${url.search}${url.hash}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online]);
  return null;
}
