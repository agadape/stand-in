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
  World: (
    <svg {...icon} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  ),
  Rooms: (
    <svg {...icon} aria-hidden>
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M3 21h18M14.500 12h.01" />
    </svg>
  ),
  Wall: (
    <svg {...icon} aria-hidden>
      <circle cx="6" cy="7" r="2.500" />
      <circle cx="18" cy="8" r="2.500" />
      <circle cx="11" cy="18" r="2.500" />
      <path d="M8.400 7.300l7.200.5M7 9.300l3 6.400M16.600 10l-4.200 6" />
    </svg>
  ),
  "Make your pet": (
    <svg {...icon} aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

type Tab = { href: string; label: string };

function useTabs(): { pet: Tab[]; site: Tab[] } {
  const pet = useMyPet();
  const home = pet ? `/t/${pet.slug}` : null;
  return {
    pet: home
      ? [
          // The world is home; the pet's own page comes second.
          { href: "/world", label: "World" },
          { href: home, label: "Pet" },
          { href: `${home}/wardrobe`, label: "Wardrobe" },
          { href: `${home}/activity`, label: "Activity" },
        ]
      : [],
    site: [
      ...(home ? [] : [{ href: "/world", label: "World" }]),
      { href: "/rooms", label: "Rooms" },
      { href: "/wall", label: "Wall" },
      ...(home ? [] : [{ href: "/new", label: "Make your pet" }]),
    ],
  };
}

/** Phones: Pet / Wardrobe / Activity along the bottom, for someone who has a pet on this device. */
export function BottomNav() {
  const { pet } = useTabs();
  const path = usePathname();
  if (pet.length === 0) return null;

  return (
    <nav aria-label="Your pet" className="fixed inset-x-0 bottom-0 z-10 border-t-2 border-border bg-background md:hidden">
      <ul className="mx-auto grid w-full max-w-md grid-cols-4 gap-1 px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {pet.map((tab) => {
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

/** Laptops and up: everything in one rail down the left side. */
export function SideNav() {
  const { pet, site } = useTabs();
  const path = usePathname();

  return (
    <nav aria-label="Main" className="fixed inset-y-0 left-0 z-10 hidden w-60 flex-col gap-1 border-r-2 border-border bg-background p-4 md:flex">
      <Link href="/" className="mb-4 px-3 py-2 text-3xl font-black lowercase tracking-tight text-accent">
        stand-in
      </Link>
      {[...pet, ...site].map((tab) => {
        const active = path === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 items-center gap-4 rounded-xl border-2 px-3 text-sm font-extrabold uppercase tracking-wide ${
              active ? "border-blue/40 bg-blue/10 text-blue" : "border-transparent text-muted hover:bg-paper"
            }`}
          >
            {ICONS[tab.label]}
            {tab.label}
          </Link>
        );
      })}
      <p className="mt-auto px-3 text-xs text-muted">Built on Monad for Metropolis. Testnet money only.</p>
    </nav>
  );
}
