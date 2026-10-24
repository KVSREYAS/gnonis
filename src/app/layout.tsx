import type { Metadata, Viewport } from "next";
import { Anton, Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { getRenameMap } from "@/lib/content/renames";
import { Providers } from "@/components/providers";
import { Hud } from "@/components/hud";
import { DIVE_PANEL_BOOT_SCRIPT } from "@/lib/chat/dive-panel";
import { SETTINGS_BOOT_SCRIPT } from "@/lib/settings";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"], display: "swap" });
const body = Atkinson_Hyperlegible({ variable: "--font-body", weight: ["400", "700"], subsets: ["latin"], display: "swap" });
const code = JetBrains_Mono({ variable: "--font-code", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Gnosis", template: "%s · Gnosis" },
  description: "Learn LLM inference by doing: tokens, attention, KV caches, rooflines and the systems that serve models.",
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${anton.variable} ${body.variable} ${code.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SETTINGS_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: DIVE_PANEL_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers renames={getRenameMap()}>
          <a
            href="#main"
            className="sr-only z-50 rounded bg-gold px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <Hud />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
