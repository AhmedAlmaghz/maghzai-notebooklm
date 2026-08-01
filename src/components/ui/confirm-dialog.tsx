"use client";

import { useState } from "react";
import Modal from "./modal";
import Button from "./button";
import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onCancel();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      hideCloseButton
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            isLoading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div
          className={`grid h-14 w-14 place-items-center rounded-2xl ${
            variant === "danger"
              ? "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400"
              : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          }`}
        >
          <AlertTriangle size={26} />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
        </div>
      </div>
    </Modal>
  );
}