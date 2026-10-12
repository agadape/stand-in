"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMyPet } from "@/lib/owner-client";

const icon = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<string, ReactNode> = {
  Pet: (
    <svg {...icon} aria-hidden>
      <circle cx="7" cy="6" r="2.2" />
      <circle cx="17" cy="6" r="2.2" />
      <path d="M12 6c4.4 0 7.5 3.2 7.5 7.4 0 4-3.2 6.6-7.5 6.6s-7.5-2.6-7.5-6.6C4.500 9.200 7.600 6 12 6Z" />
      <path d="M9.500 12.500v.5M14.500 12.500v.5M10 16q2 1.500 4 0" />
    </svg>
  ),
  Wardrobe: (
    <svg {...icon} aria-hidden>
      <path d="M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3c-.7 1.300-2 2-4 2s-3.300-.7-4-2Z" />
    </svg>
  ),
  Activity: (
    <svg {...icon} aria-hidden>
      <path d="M5 6h.01M5 12h.01M5 18h.01M9 6h10M9 12h10M9 18h10" />
    </svg>
  ),
};

/** Pet / Wardrobe / Activity, for someone who has a pet on this device. Nothing otherwise. */
export function BottomNav() {
  const pet = useMyPet();
  const path = usePathname();
  if (!pet) return null;

  const home = `/t/${pet.slug}`;
  const tabs = [
    { href: home, label: "Pet" },
    { href: `${home}/wardrobe`, label: "Wardrobe" },
    { href: `${home}/activity`, label: "Activity" },
  ];

  return (
    <nav aria-label="Your pet" className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-border bg-background">
      <ul className="mx-auto grid w-full max-w-md grid-cols-3 gap-2 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = path === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 text-[11px] font-extrabold uppercase tracking-wide ${
                  active ? "border-blue/40 bg-blue/10 text-blue" : "border-transparent text-muted hover:bg-paper"
                }`}
              >
                {ICONS[tab.label]}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
