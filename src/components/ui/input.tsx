"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, hint, leftIcon, rightIcon, fullWidth = true, className = "", id, ...props },
    ref
  ) => {
    // useId is hydration-safe: it produces identical IDs on server and client,
    // avoiding the mismatch caused by Math.random() during render.
    const generatedId = useId();
    const inputId = id || `input-${props.name || generatedId}`;

    return (
      <div className={`${fullWidth ? "w-full" : ""} space-y-1.5`}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-slate-400" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={error || hint ? `${inputId}-desc` : undefined}
            className={`w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm outline-none transition focus:bg-white focus:ring-2 dark:bg-slate-950 dark:text-slate-100 ${
              leftIcon ? "pr-10" : ""
            } ${rightIcon ? "pl-10" : ""} ${
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-100 dark:border-red-900 dark:focus:ring-red-950"
                : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-100 dark:border-slate-800 dark:focus:ring-indigo-950"
            } ${className}`}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>
        {(error || hint) && (
          <p
            id={`${inputId}-desc`}
            className={`text-[11px] font-medium ${error ? "text-red-500" : "text-slate-400"}`}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
