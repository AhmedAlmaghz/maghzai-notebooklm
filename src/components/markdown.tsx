"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Components } from "react-markdown";

const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

// Arabic Unicode block: U+0600–U+06FF
const ARABIC_RE = /[\u0600-\u06FF]/;

/**
 * Escape dollar signs that are either:
 *  1. Immediately adjacent to an Arabic character, or
 *  2. Wrapping a string that contains Arabic characters.
 *
 * This prevents remark-math from treating Arabic text as LaTeX math,
 * while leaving genuine math expressions (e.g. $x^2$) untouched.
 */
function sanitizeArabicDollars(content: string): string {
  // Replace $...$ and $$...$$ blocks that contain Arabic characters
  // with the same text but with the $ signs escaped (\$).
  return content
    // Block math: $$...$$
    .replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
      if (ARABIC_RE.test(inner)) {
        return `\\$\\$${inner}\\$\\$`;
      }
      return match;
    })
    // Inline math: $...$
    .replace(/\$([^\n$]*?)\$/g, (match, inner) => {
      if (ARABIC_RE.test(inner)) {
        return `\\$${inner}\\$`;
      }
      return match;
    });
}

const components: Components = {
  img: ({ src, alt, ...props }) => {
    if (!src) return null;
    return (
      <span className="my-3 block">
        <img
          src={src}
          alt={alt || "صورة"}
          loading="lazy"
          className="max-h-96 max-w-full rounded-2xl border border-slate-200 object-contain shadow-sm dark:border-slate-800"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            const fallback = document.createElement("span");
            fallback.className = "block rounded-xl bg-slate-100 dark:bg-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400";
            fallback.textContent = `تعذر تحميل الصورة: ${alt || src}`;
            target.parentNode?.appendChild(fallback);
          }}
          {...props}
        />
        {alt && <span className="mt-1.5 block text-center text-xs text-slate-500 dark:text-slate-400">{alt}</span>}
      </span>
    );
  },
  
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="rounded-lg bg-indigo-50 px-1.5 py-0.5 font-mono text-[0.85em] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className={`${className} block overflow-x-auto rounded-2xl bg-slate-900 dark:bg-slate-950 p-4 font-mono text-sm text-slate-100 border border-slate-800`} {...props}>
        {children}
      </code>
    );
  },
  
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 dark:text-indigo-400 font-semibold underline decoration-indigo-300 underline-offset-2 transition hover:text-indigo-800 hover:decoration-indigo-500"
      {...props}
    >
      {children}
    </a>
  ),
  
  table: ({ children, ...props }) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th className="bg-slate-100 dark:bg-slate-800/80 px-4 py-3 text-right font-bold text-slate-900 dark:text-white" {...props}>
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 text-slate-700 dark:text-slate-300" {...props}>
      {children}
    </td>
  ),
  
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="my-4 border-r-4 border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 py-2.5 pr-4 pl-3 italic text-slate-800 dark:text-slate-200 rounded-l-xl"
      {...props}
    >
      {children}
    </blockquote>
  ),
  
  ul: ({ children, ...props }) => (
    <ul className="my-2.5 list-inside list-disc space-y-1 pr-4 text-slate-800 dark:text-slate-200" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-2.5 list-inside list-decimal space-y-1 pr-4 text-slate-800 dark:text-slate-200" {...props}>
      {children}
    </ol>
  ),
  
  h1: ({ children, ...props }) => (
    <h1 className="mb-3 mt-6 border-b border-slate-200 dark:border-slate-800 pb-2 text-2xl font-black text-slate-900 dark:text-white" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="mb-2.5 mt-5 text-xl font-bold text-slate-900 dark:text-white" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="mb-2 mt-4 text-lg font-bold text-slate-800 dark:text-slate-100" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="mb-1.5 mt-3 text-base font-bold text-slate-800 dark:text-slate-100" {...props}>
      {children}
    </h4>
  ),
  
  p: ({ children, ...props }) => (
    <p className="my-2 leading-relaxed text-slate-800 dark:text-slate-200" {...props}>
      {children}
    </p>
  ),
  
  hr: ({ ...props }) => <hr className="my-6 border-slate-200 dark:border-slate-800" {...props} />,
};

export default function Markdown({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const safeContent = sanitizeArabicDollars(content);
  return (
    <>
      <link rel="stylesheet" href={KATEX_CSS} />
      <div className={`prose prose-slate dark:prose-invert prose-sm max-w-none ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]}
          components={components}
        >
          {safeContent}
        </ReactMarkdown>
      </div>
    </>
  );
}

export function MathBlock({ math, display = false }: { math: string; display?: boolean }) {
  const content = display ? `$$${math}$$` : `$${math}$`;
  return <Markdown content={content} />;
}
