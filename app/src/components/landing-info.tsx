"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * "How it works", kept off the landing page until someone asks for it. The landing page is
 * one screen with one way in; the explanation opens over it and closes back to it.
 */
export function LandingInfo({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="min-h-11 rounded-full border-2 border-white/40 bg-white/10 px-4 text-xs font-extrabold uppercase tracking-wide text-white backdrop-blur-sm hover:bg-white/20"
      >
        How it works
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="How it works" className="no-scrollbar fixed inset-0 z-20 overflow-y-auto bg-[#1b1740]/90 text-left text-white backdrop-blur-md">
          <div className="mx-auto w-full max-w-5xl space-y-8 px-5 pt-5 pb-12 md:px-10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl font-black lowercase tracking-tight">stand-in</p>
              <button
                ref={close}
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-full border-2 border-white/40 bg-white/10 px-4 text-xs font-extrabold uppercase tracking-wide hover:bg-white/20"
              >
                Close
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
