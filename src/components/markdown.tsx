import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeFrame } from "@/components/code-frame";
import { highlightCode } from "@/lib/highlight";
import { resolveLanguage, splitMarkdownFences } from "@/lib/highlight-parse";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

/** Server-rendered lesson markdown (GFM tables, KaTeX maths, Shiki code). Raw HTML is not allowed. */
export async function Markdown({ source, defaultLanguage }: { source: string; defaultLanguage?: string }) {
  const segments = splitMarkdownFences(source);
  const highlighted = await Promise.all(
    segments.map((segment) =>
      segment.type === "code" ? highlightCode(segment.code, resolveLanguage(segment.lang, defaultLanguage)) : null,
    ),
  );
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "code") {
          const lang = resolveLanguage(segment.lang, defaultLanguage);
          return <CodeFrame key={index} html={highlighted[index]!} lang={lang} lineCount={segment.lineCount} />;
        }
        return (
          <ReactMarkdown key={index} remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
            {segment.markdown}
          </ReactMarkdown>
        );
      })}
    </>
  );
}
