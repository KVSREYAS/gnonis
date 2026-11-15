"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Client markdown for the tutor chat. Lesson cards use the server `Markdown`
 * component, which runs Shiki at render time. Chat stays on this lighter path
 * so Shiki is not shipped to the browser.
 */
export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
      {source}
    </ReactMarkdown>
  );
}
