"use client";

import { useEffect, useCallback } from "react";

interface KeyboardShortcut {
  key: string;
  action: () => void;
  description: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

/**
 * Custom hook for keyboard shortcuts
 */
export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === (event.ctrlKey || event.metaKey);
        const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
        const altMatch = !!shortcut.altKey === event.altKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          // Skip if in input field (unless it's a global shortcut)
          if (isInputField && !shortcut.ctrlKey) continue;
          
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Common keyboard shortcuts for the notebook workspace
 */
export function useNotebookShortcuts(options: {
  onSendMessage?: () => void;
  onNewSource?: () => void;
  onToggleSources?: () => void;
  onToggleStudio?: () => void;
  onSearch?: () => void;
  onCloseModal?: () => void;
  enabled?: boolean;
}) {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: "Enter",
      ctrlKey: true,
      action: options.onSendMessage || (() => {}),
      description: "إرسال السؤال",
    },
    {
      key: "n",
      ctrlKey: true,
      action: options.onNewSource || (() => {}),
      description: "مصدر جديد",
    },
    {
      key: "s",
      ctrlKey: true,
      action: options.onToggleSources || (() => {}),
      description: "تبديل لوحة المصادر",
    },
    {
      key: "t",
      ctrlKey: true,
      action: options.onToggleStudio || (() => {}),
      description: "تبديل لوحة الاستوديو",
    },
    {
      key: "k",
      ctrlKey: true,
      action: options.onSearch || (() => {}),
      description: "بحث سريع",
    },
    {
      key: "Escape",
      action: options.onCloseModal || (() => {}),
      description: "إغلاق النافذة",
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled: options.enabled });
}