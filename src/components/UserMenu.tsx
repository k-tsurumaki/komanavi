"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (status === "loading") {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
    );
  }

  if (!session) {
    return (
      <Link
        href="/login"
        className="ui-btn ui-btn-primary px-4 py-2 text-sm !text-white"
      >
        ログイン
      </Link>
    );
  }

  const user = session.user;
  const initials = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-full border border-transparent p-0.5 hover:border-slate-300"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {user?.image ? (
          <Image
            src={user.image}
            alt={user.name || "ユーザー"}
            width={32}
            height={32}
            className="rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            {initials}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="ui-card absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl py-1">
          <div className="border-b border-slate-200/70 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {user?.name || "ユーザー"}
            </p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="py-1.5">
            <Link
              href="/mypage"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => setIsOpen(false)}
            >
              Myページ
            </Link>
          </div>
          <div className="border-t border-slate-200/70 py-1.5">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100"
            >
              ログアウト
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
