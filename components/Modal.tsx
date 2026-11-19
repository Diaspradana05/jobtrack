"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Kerangka dialog yang dipakai bersama: role="dialog", tutup dengan Esc, kunci scroll halaman,
 * fokus berpindah ke dalam dialog lalu kembali ke tombol pemicu, dan Tab tidak keluar dari dialog.
 * `dismissOnBackdrop`: klik area gelap menutup dialog (matikan untuk form agar isian tidak hilang tak sengaja).
 */
export default function Modal({
  label,
  onClose,
  dismissOnBackdrop = true,
  children,
}: {
  label: string;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const downOnBackdrop = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // fokus ke isian pertama (atau panel) agar pembaca layar dan keyboard langsung berada di dalam dialog
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>("input:not([type=file]):not([type=hidden]):not([hidden]), select, textarea");
    (first ?? panel)?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (dismissOnBackdrop && downOnBackdrop.current && e.target === e.currentTarget) onClose();
        downOnBackdrop.current = false;
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-lg animate-pop overflow-y-auto rounded-3xl bg-white p-6 shadow-lift outline-none"
      >
        {children}
      </div>
    </div>
  );
}
