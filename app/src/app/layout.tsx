import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stand-In", template: "%s · Stand-In" },
  description:
    "Meet someone, scan or tap, and your AI pets do the talking. Every friendship is recorded on Monad.",
};

export const viewport: Viewport = { themeColor: "#151515" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Stand-In
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted">
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
