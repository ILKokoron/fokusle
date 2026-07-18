import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const THEMES: Record<string, { accent: string; cardBg: string; line: string; bg: string }> = {
  purple: { accent: "#8b7bff", cardBg: "#cfc6ff", line: "#3a2f66", bg: "#0E091C" },
  red: { accent: "#ff5b5b", cardBg: "#ff6b6b", line: "#5e2a2a", bg: "#150a0a" },
  mono: { accent: "#cfcfcf", cardBg: "#e6e6e6", line: "#333", bg: "#0b0b0b" },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const score = searchParams.get("score") ?? "0%";
  const today = searchParams.get("today") ?? "0h 0m";
  const weekly = searchParams.get("weekly") ?? "0h 0m";
  const streak = searchParams.get("streak") ?? "0D";
  const handle = searchParams.get("handle") ?? "@fokusle";
  const wallet = searchParams.get("wallet") ?? "";
  const themeKey = searchParams.get("theme") ?? "purple";
  const t = THEMES[themeKey] ?? THEMES.purple;

  let fontData: ArrayBuffer;
  try {
    const f = await fetch("https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff");
    fontData = await f.arrayBuffer();
  } catch {
    fontData = new ArrayBuffer(0);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: t.bg,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          fontFamily: "Inter, sans-serif",
          color: "#fff",
        }}
      >
        {/* LEFT */}
        <div
          style={{
            width: "62%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            padding: 56,
            borderRight: `1px solid ${t.line}`,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#fff" }}>FokusLe</div>
            <div style={{ fontSize: 20, color: t.accent, marginLeft: 20, letterSpacing: 3 }}>PROOF OF FOCUS</div>
          </div>

          {/* FOCUS SCORE dominan */}
          <div
            style={{
              marginTop: 32,
              background: t.cardBg,
              borderRadius: 18,
              padding: "28px 36px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1a1030", letterSpacing: 2 }}>FOCUS SCORE</div>
            <div style={{ fontSize: 180, fontWeight: 900, color: "#0a0a0a", lineHeight: 1 }}>{score}</div>
          </div>

          {/* STATS */}
          <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
            <Stat label="TODAY" value={today} line={t.line} />
            <Stat label="WEEKLY" value={weekly} line={t.line} />
            <Stat label="STREAK" value={streak} line={t.line} />
          </div>

          {/* IDENTITY */}
          <div style={{ marginTop: "auto" }}>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{handle}</div>
            <div style={{ fontSize: 18, fontFamily: "monospace", color: "#aaa", marginTop: 4 }}>{wallet}</div>
            <div style={{ fontSize: 16, color: t.accent, marginTop: 10, letterSpacing: 1 }}>
              MONAD TESTNET · WALLET = IDENTITY
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div
          style={{
            width: "38%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 40,
            boxSizing: "border-box",
            background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.4))",
          }}
        >
          <div style={{ fontSize: 22, color: t.accent, letterSpacing: 2 }}>LOCKED IN</div>
          <div style={{ fontSize: 18, color: t.accent, opacity: 0.6, textAlign: "right" }}>// ART PLACEHOLDER</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: fontData.byteLength > 0 ? [{ name: "Inter", data: fontData, weight: 400, style: "normal" }] : undefined,
    }
  );
}

function Stat({ label, value, line }: { label: string; value: string; line: string }) {
  return (
    <div
      style={{
        flex: 1,
        border: `1px solid ${line}`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ fontSize: 18, color: "#9a8fff", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginTop: 6 }}>{value}</div>
    </div>
  );
}
