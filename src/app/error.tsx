"use client";

import { useEffect } from "react";
import Button from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="grid h-24 w-24 place-items-center rounded-3xl bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
        <AlertTriangle size={48} />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white">خطأ في الخادم</h1>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى لاحقاً.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-slate-400">معرف الخطأ: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.location.assign("/")}>
          العودة للصفحة الرئيسية
        </Button>
        <Button variant="primary" onClick={reset}>
          إعادة المحاولة
        </Button>
      </div>
    </div>
  );
}