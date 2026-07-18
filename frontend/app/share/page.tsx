import { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: { score?: string; today?: string; weekly?: string; streak?: string; handle?: string; wallet?: string; theme?: string };
}): Promise<Metadata> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://fokusle.vercel.app";
  const qs = new URLSearchParams({
    score: searchParams.score ?? "0%",
    today: searchParams.today ?? "0h 0m",
    weekly: searchParams.weekly ?? "0h 0m",
    streak: searchParams.streak ?? "0D",
    handle: searchParams.handle ?? "@fokusle",
    wallet: searchParams.wallet ?? "",
    theme: searchParams.theme ?? "purple",
  });
  const img = `${base}/api/og?${qs.toString()}`;
  return {
    title: "FokusLe — Locked In",
    openGraph: {
      title: "FokusLe — Proof of Focus",
      description: "Flex consistency, not PnL.",
      images: [{ url: img, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "FokusLe — Locked In",
      description: "Proof of Focus, onchain.",
      images: [img],
    },
  };
}

export default function SharePage() {
  return (
    <div style={{ background: "#0E091C", color: "#fff", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>FokusLe</h1>
        <p style={{ color: "#8b7bff" }}>Your Lock-In Card is ready to share.</p>
        <p style={{ color: "#888", fontSize: 13 }}>Open this page inside a tweet to preview the card.</p>
      </div>
    </div>
  );
}
