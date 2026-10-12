import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stand-In", template: "%s · Stand-In" },
  description:
    "Meet someone, scan or tap, and your AI pets do the talking. Every friendship is recorded on Monad.",
};

export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-md items-center justify-between border-b-2 border-border px-4 py-1">
          <Link href="/" className="flex min-h-11 items-center text-xl font-black lowercase tracking-tight text-accent">
            Stand-In
          </Link>
          <nav className="flex items-center gap-4 text-xs font-extrabold uppercase tracking-wide text-muted [&_a]:flex [&_a]:min-h-11 [&_a]:items-center">
            <Link href="/rooms" className="hover:text-foreground">
              Rooms
            </Link>
            <Link href="/wall" className="hover:text-foreground">
              Wall
            </Link>
            <Link href="/new" className="hover:text-foreground">
              Make your pet
            </Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
        {/* Bottom padding leaves room for the tab bar a pet owner gets. */}
        <footer className="mx-auto w-full max-w-md px-4 pb-24 text-xs text-muted">
          Built on Monad for Metropolis. Testnet money only.
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
