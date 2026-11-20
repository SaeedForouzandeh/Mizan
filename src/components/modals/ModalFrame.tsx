import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalFrameProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function ModalFrame({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidthClass = 'max-w-lg',
}: ModalFrameProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mizan-modal-title"
        className={`w-full ${maxWidthClass} mizan-glass-strong rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="sm:hidden shrink-0 w-10 h-1.5 rounded-full bg-amber-900/20 dark:bg-amber-200/20 mx-auto mt-2.5" />

        <div className="shrink-0 flex items-start justify-between gap-3 px-5 py-3.5 border-b border-amber-900/10 dark:border-amber-200/10">
          <div className="min-w-0">
            <h2 id="mizan-modal-title" className="text-base sm:text-lg font-bold truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs text-[#6E5643] dark:text-[#B8A593] mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن پنجره"
            className="min-w-[40px] min-h-[40px] rounded-full hover:bg-amber-900/8 dark:hover:bg-amber-400/12 flex items-center justify-center text-[#6E5643] dark:text-[#B8A593] shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
