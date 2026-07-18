import type { Metadata } from "next";
import { Providers } from "./providers";
import GlobalError from "./global-error";

export const metadata: Metadata = {
  title: "Fokusle — Proof of Focus, Proof of Discipline",
  description: "A productivity app for Web3 users. Flex consistency, not PnL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, background: "#0b0e14", color: "#e6e6e6", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <GlobalError>
          <Providers>{children}</Providers>
        </GlobalError>
      </body>
    </html>
  );
}
