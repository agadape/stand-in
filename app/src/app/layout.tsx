import type { Metadata, Viewport } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import Link from "next/link";
import { BottomNav, SideNav, VisitorMark } from "@/components/bottom-nav";
import { sessionPet } from "@/lib/session-cookie";
import "./globals.css";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stand-In", template: "%s · Stand-In" },
  description:
    "An AI pet with your voice lives its own life in a town of agents. You watch and turn dials; you can't steer. Introductions need both humans and are recorded on Monad.",
};

export const viewport: Viewport = { themeColor: "#ffffff", viewportFit: "cover" };

/**
 * Two shells. A signed-in resident (a valid session for a pet they proved they own) gets
 * the side rail, the phone header and the tab bar. Everyone else gets no navigation: the
 * check is made here on the server, so the menu is not in a visitor's page to be found.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pet = await sessionPet();
  const resident = pet ? { slug: pet.slug } : null;
  return (
    <html lang="en" className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}>
      <body className={`flex min-h-full flex-col overflow-x-clip ${resident ? "md:pl-60" : ""}`}>
        {resident ? (
          <>
            <SideNav resident={resident} />
            <header className="mx-auto flex w-full max-w-md items-center justify-between border-b-2 border-border px-4 py-1 md:hidden">
              <Link href="/world" className="flex min-h-11 items-center text-xl font-black lowercase tracking-tight text-accent">
                Stand-In
              </Link>
              <nav className="flex items-center gap-4 text-xs font-extrabold uppercase tracking-wide text-muted [&_a]:flex [&_a]:min-h-11 [&_a]:items-center">
                <Link href="/rooms" className="hover:text-foreground">
                  Rooms
                </Link>
                <Link href="/wall" className="hover:text-foreground">
                  Wall
                </Link>
                <Link href="/mera" className="hover:text-foreground">
                  Keys
                </Link>
              </nav>
            </header>
          </>
        ) : (
          <VisitorMark />
        )}
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 md:max-w-xl md:px-8 md:py-10 lg:max-w-5xl lg:px-10">{children}</main>
        <footer className={`mx-auto w-full max-w-md px-4 text-xs text-muted ${resident ? "pb-24 md:hidden" : "pb-8 md:max-w-xl md:px-8 lg:max-w-5xl lg:px-10"}`}>
          Built on Monad for Metropolis. Testnet money only.
        </footer>
        {resident && <BottomNav resident={resident} />}
      </body>
    </html>
  );
}
