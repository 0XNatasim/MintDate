import type { Metadata } from "next";
import Link from "next/link";
import { Zap } from "lucide-react";
import { config } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "MintDate — Don't miss another mint",
  description:
    "Paste an X account and MintDate finds the mint: date, time, price, chain, links — verified against OpenSea when possible.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen mint-backdrop">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
          <div className="container flex h-14 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </span>
              <span>MintDate</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">
                Dashboard
              </Link>
              {config.mockMode && (
                <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  MOCK MODE
                </span>
              )}
            </nav>
          </div>
        </header>
        <main className="container py-8">{children}</main>
        <footer className="border-t border-border/60 py-6">
          <div className="container text-xs text-muted-foreground">
            MintDate · Never invents a mint date — unknown data stays unknown. Always verify links before connecting a wallet.
          </div>
        </footer>
      </body>
    </html>
  );
}
