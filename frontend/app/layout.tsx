import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, Roboto_Mono } from "next/font/google";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fokusle — Proof of Focus. Proof of Discipline.",
  description: "Lock in. Focus. Prove it onchain. Wallet = identity. No staking, no token.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0712",
};

// Self-hosted fonts via next/font — no external request (fixes 413 font load),
// works offline, and prevents layout shift. Variables injected on <html>.
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-grotesk", display: "swap" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const mono = Roboto_Mono({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-mono", display: "swap" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${inter.variable} ${mono.variable}`}>
      <body style={{ margin: 0, background: "#0a0712", backgroundImage: "linear-gradient(rgba(110,84,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(110,84,255,0.06) 1px, transparent 1px)", backgroundSize: "26px 26px", color: "#e6e6e6", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
