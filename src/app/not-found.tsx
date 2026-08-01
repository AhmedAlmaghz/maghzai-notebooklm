import Link from "next/link";
import Button from "@/components/ui/button";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 p-8 text-center dark:bg-slate-950">
      <div className="grid h-24 w-24 place-items-center rounded-3xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
        <FileQuestion size={48} />
      </div>
      <div className="space-y-2">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white">404</h1>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">الصفحة غير موجودة</h2>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. ربما تم نقلها أو حذفها.
        </p>
      </div>
      <Link href="/" passHref>
        <Button>العودة للصفحة الرئيسية</Button>
      </Link>
    </div>
  );
}