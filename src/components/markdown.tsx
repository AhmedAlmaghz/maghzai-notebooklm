"use client";

import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Components } from "react-markdown";
import { visit } from "unist-util-visit";

const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";

// Inject the KaTeX stylesheet exactly once on the client. Previously this
// `<link>` tag was rendered per Markdown instance (i.e. once per chat
// message), causing the browser to repeatedly fetch/re-parse the same CSS and
// noticeably freezing the notebook page when many messages were present.
if (typeof document !== "undefined") {
  if (!document.getElementById("katex-css")) {
    const link = document.createElement("link");
    link.id = "katex-css";
    link.rel = "stylesheet";
    link.href = KATEX_CSS;
    document.head.appendChild(link);
  }
}

// Regex matching non-Latin scripts (Arabic, Tamil, Devanagari, Thai, etc.)
// that KaTeX cannot render. Math nodes containing these characters are
// converted back to plain text to avoid "No character metrics" errors.
const NON_LATIN_SCRIPT_REGEX = /[\u0600-\u06FF\u0B80-\u0BFF\u0900-\u097F\u0E00-\u0E7F]/;

function remarkFilterNonLatinMath() {
  return (tree: any) => {
    visit(tree, (node: any) => {
      if (node.type === "inlineMath" || node.type === "math") {
        const value = node.value || "";
        if (NON_LATIN_SCRIPT_REGEX.test(value)) {
          node.type = "text";
          node.value = value;
          delete node.data;
        }
      }
    });
  };
}

/**
 * KaTeX (via rehype-katex) only supports Latin/Cyrillic scripts plus a small
 * set of math symbols. When the LLM wraps Arabic (or Tamil, CJK, emoji, ...)
 * text inside `$...$` / `$$...$$`, KaTeX tries to typeset those characters as
 * math and floods the console with warnings like:
 *
 *   No character metrics for 'س' in style 'Main-Regular' and mode 'text'
 *   LaTeX-incompatible input and strict mode is set to 'warn': Unrecognized
 *   Unicode character "ت" (1578) [unknownSymbol]
 *
 * These ranges cover scripts that have no KaTeX font metrics.
 */
const NON_MATH_SCRIPT =
  /[\u0590-\u05FF\u0600-\u08FF\u0B00-\u0BFF\u0E00-\u0E7F\u0F00-\u0FFF\u2E80-\u303F\u3040-\u30FF\u3400-\u9FFF\uA000-\uA48F\uAC00-\uD7AF\uF900-\uFAFF\uFB00-\uFDFF\uFE70-\uFEFF\u{1F000}-\u{1FAFF}\u{2600}-\u27BF\u{FE0F}\u{200D}]/u;

/** Strip LaTeX syntax so a span reads as plain prose (no backslash commands). */
function mathSpanToPlainText(span: string): string {
  return span
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}\\_^~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rewrites markdown so that any `$...$` / `$$...$$` span containing a script
 * KaTeX cannot typeset is converted to plain text. Genuine math (Latin digits,
 * variables, operators, LaTeX commands, Greek letters) is left untouched.
 */
function neutralizeNonMathSpans(md: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < md.length) {
    const c = md[i];

    // A `$` preceded by a letter/number, or followed by whitespace, is not a
    // math delimiter (e.g. "$10", "السعر $ 5"). Skip it.
    if (c === "$") {
      const prev = md[i - 1];
      const next = md[i + 1];
      const isDelimiter =
        next !== undefined &&
        next !== " " &&
        next !== "\t" &&
        next !== "\n" &&
        !(prev && /[\p{L}\p{N}]/u.test(prev));

      if (isDelimiter && next === "$") {
        const end = md.indexOf("$$", i + 2);
        if (end === -1) {
          out.push(md.slice(i));
          break;
        }
        const body = md.slice(i + 2, end);
        if (NON_MATH_SCRIPT.test(body)) {
          const plain = mathSpanToPlainText(body);
          out.push(plain ? `\n\n${plain}\n\n` : "");
        } else {
          out.push(`$$${body}$$`);
        }
        i = end + 2;
        continue;
      }

      if (isDelimiter) {
        const end = md.indexOf("$", i + 1);
        if (end === -1) {
          out.push(md.slice(i));
          break;
        }
        const body = md.slice(i + 1, end);
        if (NON_MATH_SCRIPT.test(body)) {
          out.push(mathSpanToPlainText(body));
        } else {
          out.push(`$${body}$`);
        }
        i = end + 1;
        continue;
      }
    }

    out.push(c);
    i++;
  }
  return out.join("");
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

function MarkdownComponent({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  // Memoize the sanitization step so re-renders with unchanged content skip the
  // expensive per-character scan + remark/rehype pipeline.
  const sanitized = useMemo(() => neutralizeNonMathSpans(content), [content]);

  return (
    <div className={`prose prose-slate dark:prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkFilterNonLatinMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}

// Memoize the whole component so sibling state updates (e.g. typing in the
// chat input) do not re-parse and re-render every historical message.
const Markdown = memo(MarkdownComponent);

export default Markdown;

export function MathBlock({ math, display = false }: { math: string; display?: boolean }) {
  const content = display ? `$$${math}$$` : `$${math}$`;
  return <Markdown content={content} />;
}
