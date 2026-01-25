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
        className={`inline-flex h-8 w-8 items-center justify-center text-gray-700 hover:text-gray-900 ${
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
          className="absolute right-0 mt-2 w-32 rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleDeleteClick}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            disabled={disabled}
          >
            削除
          </button>
        </div>
      )}
    </div>
  );
}