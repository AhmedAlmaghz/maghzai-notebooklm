"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Button from "./ui/button";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">حدث خطأ غير متوقع</h2>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              عذراً، حدث خطأ أثناء عرض هذا الجزء من التطبيق. يمكنك إعادة المحاولة.
            </p>
          </div>
          <Button variant="primary" onClick={this.handleReset}>
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}