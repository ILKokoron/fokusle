import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fokusle — Proof of Focus, Proof of Discipline",
  description: "A productivity app for Web3 users. Flex consistency, not PnL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0e14", color: "#e6e6e6", fontFamily: "system-ui, sans-serif" }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
