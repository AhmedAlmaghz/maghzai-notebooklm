"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_STYLES: Record<ToastType, { icon: ReactNode; container: string; iconColor: string }> = {
  success: {
    icon: <CheckCircle2 size={18} />,
    container: "border-emerald-200 bg-white dark:border-emerald-900/60 dark:bg-slate-900",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: <XCircle size={18} />,
    container: "border-red-200 bg-white dark:border-red-900/60 dark:bg-slate-900",
    iconColor: "text-red-500",
  },
  info: {
    icon: <Info size={18} />,
    container: "border-blue-200 bg-white dark:border-blue-900/60 dark:bg-slate-900",
    iconColor: "text-blue-500",
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    container: "border-amber-200 bg-white dark:border-amber-900/60 dark:bg-slate-900",
    iconColor: "text-amber-500",
  },
};

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info") => {
      const id = `toast-${Date.now()}-${toastCounter++}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const success = useCallback((message: string) => showToast(message, "success"), [showToast]);
  const error = useCallback((message: string) => showToast(message, "error"), [showToast]);
  const info = useCallback((message: string) => showToast(message, "info"), [showToast]);
  const warning = useCallback((message: string) => showToast(message, "warning"), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      {/* Toast Render Area */}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl animate-fade-in ${style.container}`}
              role={toast.type === "error" ? "alert" : "status"}
            >
              <span className={`shrink-0 ${style.iconColor}`}>{style.icon}</span>
              <p className="flex-1 text-xs font-bold text-slate-800 dark:text-slate-100">{toast.message}</p>
              <button
                onClick={() => dismiss(toast.id)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}