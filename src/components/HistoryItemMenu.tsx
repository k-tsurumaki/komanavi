'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

type HistoryItemMenuProps = {
  onDelete: () => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
};

export function HistoryItemMenu({
  onDelete,
  disabled = false,
  className,
  buttonClassName,
}: HistoryItemMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const toggleMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleDeleteClick = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsOpen(false);
    await onDelete();
  };

  return (
    <div ref={rootRef} className={className}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggleMenu}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 ${
          buttonClassName || ''
        }`}
        disabled={disabled}
      >
        <span className="sr-only">メニュー</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {isOpen && (
        <div
          role="menu"
          className="ui-card absolute right-0 mt-2 w-32 rounded-xl border border-slate-200/80 bg-white"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50/80"
            disabled={disabled}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}
