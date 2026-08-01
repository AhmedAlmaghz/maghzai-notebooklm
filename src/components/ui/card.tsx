"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  interactive?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", hoverable = false, interactive = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${
          hoverable ? "transition-all hover:-translate-y-1 hover:shadow-xl" : ""
        } ${
          interactive
            ? "cursor-pointer transition hover:border-indigo-300 dark:hover:border-indigo-800"
            : ""
        } ${className}`}
        {...props}
      />
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

function CardHeader({ title, description, action, className = "", children, ...props }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800 ${className}`} {...props}>
      <div className="min-w-0">
        {title && <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>}
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
      {children}
    </div>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

function CardBody({ className = "", ...props }: CardBodyProps) {
  return <div className={`px-5 py-4 ${className}`} {...props} />;
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}

function CardFooter({ className = "", ...props }: CardFooterProps) {
  return (
    <div
      className={`border-t border-slate-100 px-5 py-3 dark:border-slate-800 ${className}`}
      {...props}
    />
  );
}

export { Card, CardHeader, CardBody, CardFooter };