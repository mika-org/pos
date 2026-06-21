"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Trash2, Info, ShieldAlert, X } from "lucide-react";

type ConfirmVariant = "danger" | "warning" | "info";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  isLoading?: boolean;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: React.ReactNode;
    iconBg: string;
    confirmBtn: string;
    badge: string;
    badgeText: string;
  }
> = {
  danger: {
    icon: <Trash2 size={24} className="text-rose-600" />,
    iconBg: "bg-rose-100 ring-4 ring-rose-50",
    confirmBtn:
      "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/25",
    badge: "bg-rose-50 text-rose-600 border-rose-100",
    badgeText: "Tindakan Berbahaya",
  },
  warning: {
    icon: <AlertTriangle size={24} className="text-amber-600" />,
    iconBg: "bg-amber-100 ring-4 ring-amber-50",
    confirmBtn:
      "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-500/25",
    badge: "bg-amber-50 text-amber-700 border-amber-100",
    badgeText: "Perlu Perhatian",
  },
  info: {
    icon: <Info size={24} className="text-blue-600" />,
    iconBg: "bg-blue-100 ring-4 ring-blue-50",
    confirmBtn:
      "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-500/25",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    badgeText: "Konfirmasi",
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  detail,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  isLoading = false,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cfg = variantConfig[variant];

  // Focus trap: auto-focus cancel button when opened (safe default)
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => cancelRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        {/* Top accent bar */}
        <div
          className={`h-1 w-full ${variant === "danger"
              ? "bg-linear-to-r from-rose-500 to-rose-400"
              : variant === "warning"
                ? "bg-linear-to-r from-amber-500 to-amber-400"
                : "bg-linear-to-r from-blue-500 to-blue-400"
            }`}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors z-10"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        <div className="px-6 pt-6 pb-5 space-y-4">
          {/* Header: icon + badge */}
          <div className="flex items-start space-x-4">
            <div className={`p-3 rounded-2xl shrink-0 ${cfg.iconBg}`}>
              {cfg.icon}
            </div>
            <div className="pt-0.5 space-y-1.5">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.badge}`}
              >
                <ShieldAlert size={9} className="mr-1" />
                {cfg.badgeText}
              </span>
              <h2
                id="confirm-modal-title"
                className="text-base font-black text-slate-900 leading-snug"
              >
                {title}
              </h2>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-slate-200" />

          {/* Body */}
          <div id="confirm-modal-desc" className="space-y-2">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {message}
            </p>
            {detail && (
              <p className="text-xs text-slate-400 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 font-medium">
                {detail}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-1">
            <button
              ref={cancelRef}
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!isLoading) onConfirm();
              }}
              disabled={isLoading}
              className={`flex-1 px-4 py-2.5 text-white font-extrabold rounded-xl text-sm transition-all cursor-pointer shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-1.5 ${cfg.confirmBtn}`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>{confirmLabel}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
