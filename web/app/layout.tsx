import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"]
});

const displayFont = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  title: "BaseYield",
  description: "Retail-friendly USDC yield vault on Base"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
        <Providers>
          <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 md:px-8">
            <Link href="/" className="font-display text-xl text-[color:var(--ink)]">
              BaseYield
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[color:var(--ink-muted)]">
              <Link href="/">Overview</Link>
              <Link href="/app">Dashboard</Link>
            </nav>
          </header>
          {children}
        </Providers>
      </body>
    </html>
  );
}
