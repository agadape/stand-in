"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMyPet } from "@/lib/owner-client";

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
    <nav aria-label="Your pet" className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
      <ul className="mx-auto grid w-full max-w-md grid-cols-3 px-4 pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = path === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 items-center justify-center text-sm font-semibold ${
                  active ? "text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
