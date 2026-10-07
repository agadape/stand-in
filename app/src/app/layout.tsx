import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stand-In", template: "%s · Stand-In" },
  description:
    "Your friends try to pass as you. Your AI twin decides who's real, and pays whoever pulls it off.",
};

export const viewport: Viewport = { themeColor: "#0b0b12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            Stand-In
          </Link>
          <Link href="/new" className="text-sm text-muted hover:text-foreground">
            Make your twin
          </Link>
        </header>
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
        <footer className="mx-auto w-full max-w-md px-4 pb-8 text-xs text-muted">
          Built on Monad for Metropolis. Testnet money only.
        </footer>
      </body>
    </html>
  );
}
