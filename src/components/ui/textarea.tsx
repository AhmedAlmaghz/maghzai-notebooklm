"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

interface TextareaProps extends InputHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, fullWidth = true, className = "", id, ...props }, ref) => {
    const textareaId = id || `textarea-${props.name || Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className={`${fullWidth ? "w-full" : ""} space-y-1.5`}>
        {label && (
          <label htmlFor={textareaId} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${textareaId}-desc` : undefined}
          className={`w-full resize-none rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-100 dark:border-red-900 dark:focus:ring-red-950"
              : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 dark:border-slate-800 dark:focus:ring-indigo-950"
          } ${className}`}
          {...props}
        />
        {(error || hint) && (
          <p
            id={`${textareaId}-desc`}
            className={`text-[11px] font-medium ${error ? "text-red-500" : "text-slate-400"}`}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;