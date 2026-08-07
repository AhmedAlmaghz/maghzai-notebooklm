"use client";

import { useMemo, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/* ------------------------------------------------------------------ */
/* Types & parsing                                                     */
/* ------------------------------------------------------------------ */

interface MindNode {
  id: string;
  label: string;
  children: MindNode[];
}

/**
 * Parse Mermaid `mindmap` syntax (indentation-based tree) into a MindNode tree.
 * Example:
 *   mindmap
 *     root((الموضوع الرئيسي))
 *       الفرع الأول
 *         نقطة فرعية 1
 */
function parseMindmap(content: string): MindNode | null {
  // Prefer a fully-fenced ```mermaid block. If the closing fence is missing
  // (truncated output), salvage by taking everything after the opening fence
  // as the mermaid source. Otherwise fall back to the raw content.
  const fenced = content.match(/```mermaid\n?([\s\S]*?)```/);
  let code: string;
  if (fenced) {
    code = fenced[1];
  } else {
    const openFence = content.match(/```mermaid\n?([\s\S]*)$/);
    code = openFence ? openFence[1] : content;
  }
  code = code.trim();

  const lines = code
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim().length > 0);

  // Drop the leading "mindmap" keyword line if present.
  const startIdx = lines.findIndex((l) => l.trim().toLowerCase() === "mindmap");
  const body = startIdx >= 0 ? lines.slice(startIdx + 1) : lines;

  if (body.length === 0) return null;

  // Clean a node label: strip mermaid shape markers like ((..)), [..], (..), {{..}}, ".."
  function cleanLabel(raw: string): string {
    let t = raw.trim();
    t = t.replace(/^\(\(/, "").replace(/\)\)$/, "");
    t = t.replace(/^\[/, "").replace(/\]$/, "");
    t = t.replace(/^\(/, "").replace(/\)$/, "");
    t = t.replace(/^\{\{/, "").replace(/\}\}$/, "");
    t = t.replace(/^"|"$/g, "");
    return t.trim();
  }

  // Determine indentation level from leading spaces/tabs.
  function indentOf(line: string): number {
    const m = line.match(/^[\s]*/);
    return m ? m[0].replace(/\t/g, "  ").length : 0;
  }

  const rootIndent = indentOf(body[0]);
  const root: MindNode = { id: "root", label: cleanLabel(body[0]), children: [] };
  const stack: { node: MindNode; indent: number }[] = [{ node: root, indent: rootIndent }];

  for (let i = 1; i < body.length; i++) {
    const line = body[i];
    const indent = indentOf(line);
    const node: MindNode = { id: `n-${i}`, label: cleanLabel(line), children: [] };

    // Pop stack until we find a parent with smaller indent.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    parent.children.push(node);
    stack.push({ node, indent });
  }

  return root;
}

/* ------------------------------------------------------------------ */
/* Recursive tree rendering (vertical, branching to the right)         */
/* ------------------------------------------------------------------ */

const LEVEL_COLORS = [
  "from-indigo-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
];

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: MindNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const gradient = LEVEL_COLORS[depth % LEVEL_COLORS.length];

  return (
    <div className="flex flex-col">
      {/* Node row: connector + node box */}
      <div className="flex items-center">
        {/* Horizontal connector from parent (except root) */}
        {depth > 0 && (
          <div className="h-px w-6 shrink-0 bg-slate-300 dark:bg-slate-600" />
        )}

        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={`group relative flex items-center gap-2 rounded-2xl bg-gradient-to-r ${gradient} px-4 py-2.5 text-right text-sm font-bold text-white shadow-md transition ${hasChildren
            ? "cursor-pointer hover:scale-[1.03] hover:shadow-lg"
            : "cursor-default"
            }`}
          title={hasChildren ? (isExpanded ? "طيّ التفرعات" : "إظهار التفرعات") : node.label}
        >
          <span className="max-w-[260px] truncate">{node.label}</span>

          {hasChildren && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25 text-white transition group-hover:bg-white/35">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
            </span>
          )}
        </button>
      </div>

      {/* Children: stacked vertically, indented to the right */}
      {hasChildren && isExpanded && (
        <div className="mt-1 flex flex-col gap-1.5">
          {/* Vertical connector line */}
          <div className="ml-0 h-3 w-px bg-slate-300 dark:bg-slate-600" />
          <div className="flex flex-col gap-1.5" style={{ marginLeft: 24 }}>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function MindmapViewer({ content }: { content: string }) {
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { isDark } = useTheme();

  const tree = useMemo(() => {
    try {
      const parsed = parseMindmap(content);
      if (!parsed) {
        setError("لم يتم العثور على خريطة ذهنية صالحة في هذا النص.");
        return null;
      }
      setError(null);
      return parsed;
    } catch {
      setError("حدث خطأ أثناء قراءة الخريطة الذهنية");
      return null;
    }
  }, [content]);

  // Root is always visible; expand its direct children by default.
  const effectiveExpanded = useMemo(() => {
    const set = new Set(expanded);
    if (tree) {
      set.add(tree.id);
      tree.children.forEach((c) => set.add(c.id));
    }
    return set;
  }, [expanded, tree]);

  const handleToggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.4));
  const handleReset = () => setScale(1);

  const handleDownload = () => {
    if (!tree) return;
    const svg = buildSvg(tree, effectiveExpanded);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmap.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>
        <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-white dark:bg-slate-900 p-4 text-left font-mono text-xs text-slate-600 dark:text-slate-400">
          {content.slice(0, 500)}
        </pre>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-slate-950 p-6" : ""}`}>
      {/* Controls Bar */}
      <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleZoomOut}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="تصغير"
          >
            <ZoomOut size={18} />
          </button>
          <span className="min-w-[3.5rem] text-center font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="تكبير"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleReset}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title="إعادة ضبط"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 transition"
            title="تحميل SVG"
          >
            <Download size={15} />
            تصدير SVG
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            title={isFullscreen ? "إغلاق ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div
        className="overflow-auto rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 p-6 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40"
        style={{ maxHeight: isFullscreen ? "calc(100vh - 120px)" : "520px" }}
      >
        {tree ? (
          <div
            className="inline-block min-w-full transition-transform duration-200"
            style={{ transform: `scale(${scale})`, transformOrigin: "top right" }}
          >
            <TreeNode
              node={tree}
              depth={0}
              expanded={effectiveExpanded}
              onToggle={handleToggle}
            />
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* SVG export (mirrors the on-screen vertical-right layout)            */
/* ------------------------------------------------------------------ */

function buildSvg(root: MindNode, expanded: Set<string>): string {
  const nodeW = 220;
  const nodeH = 40;
  const hGap = 60; // horizontal gap between levels (branching right)
  const vGap = 24; // vertical gap between siblings

  interface Placed {
    node: MindNode;
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const placed: Placed[] = [];

  // Compute layout: root at top-left, children below and to the right.
  function layout(node: MindNode, x: number, y: number): number {
    const isOpen = expanded.has(node.id) && node.children.length > 0;
    const w = Math.min(nodeW, Math.max(80, node.label.length * 9 + 40));
    const h = nodeH;
    placed.push({ node, x, y, w, h });

    if (!isOpen) return y + h;

    let cursor = y + h + vGap;
    for (const child of node.children) {
      const childBottom = layout(child, x + w + hGap, cursor);
      cursor = childBottom + vGap;
    }
    return cursor - vGap;
  }

  layout(root, 20, 20);

  const width = Math.max(...placed.map((p) => p.x + p.w)) + 40;
  const height = Math.max(...placed.map((p) => p.y + p.h)) + 40;

  const colors = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

  const lines = placed
    .filter((p) => p.node.children.length > 0 && expanded.has(p.node.id))
    .flatMap((p) => {
      const parentRight = p.x + p.w;
      const parentMidY = p.y + p.h / 2;
      return p.node.children.map((child) => {
        const cp = placed.find((q) => q.node.id === child.id);
        if (!cp) return "";
        const childMidY = cp.y + cp.h / 2;
        const childLeft = cp.x;
        return `<path d="M ${parentRight} ${parentMidY} H ${childLeft} V ${childMidY}" fill="none" stroke="#94a3b8" stroke-width="2"/>`;
      });
    })
    .join("");

  const nodes = placed
    .map((p, i) => {
      const color = colors[p.node.id === root.id ? 0 : (i % colors.length)];
      const label = escapeXml(p.node.label);
      return `
        <g>
          <rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="14" fill="${color}"/>
          <text x="${p.x + p.w / 2}" y="${p.y + p.h / 2}" fill="#fff" font-size="14" font-family="Cairo, sans-serif" text-anchor="middle" dominant-baseline="central">${label}</text>
        </g>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="transparent"/>
    ${lines}
    ${nodes}
  </svg>`;
}

function escapeXml(s: string): string {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  const map: Record<string, string> = {
    "&": amp,
    "<": lt,
    ">": gt,
    '"': quot,
  };
  return s.replace(/[&<>"]/g, (ch) => map[ch]);
}
