// Client-side monochrome card renderer for Fokusle Lock-In Card.
// Pure canvas, no deps, no server. Returns a PNG data URL.
// Baseline: black / white / gray only, high contrast, prominent type.

export type CardBadge = { name: string; got: boolean };

export type FokusCardData = {
  handle: string;            // display name / .nad fallback
  wallet: string;            // 0x....
  weeklySeconds: bigint;
  totalSeconds: bigint;
  streak: bigint;
  xp: bigint;
  level: bigint;
  badges: CardBadge[];
};

const W = 1200;
const H = 675; // 16:9, matches the reference card aspect

const fmt = (s: bigint) => {
  const sec = Number(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

// Monochrome palette (grayscale only)
const INK = "#ffffff";        // primary text
const INK_DIM = "#9aa0a6";    // secondary text
const INK_FAINT = "#5f646b";  // tertiary / labels
const BG = "#0a0a0a";         // near-black base
const PANEL = "#141414";      // raised panel
const LINE = "#2a2a2a";       // hairlines / borders
const ACCENT = "#e6e6e6";     // near-white for emphasis strokes

export function renderFokusCard(d: FokusCardData): string {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // ---- background: flat near-black + subtle top-down gray gradient ----
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#101010");
  bg.addColorStop(1, BG);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // faint grid (grayscale, low contrast — gives "card" texture without color)
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // ---- outer frame ----
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 28, W - 56, H - 56);

  const M = 64; // inner margin

  // ---- top row: wordmark (left) + tag (right) ----
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK;
  ctx.font = "800 38px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Fokusle", M, 96);

  ctx.fillStyle = INK_DIM;
  ctx.font = "700 20px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "right";
  // letter-spaced tag
  const tag = "PROOF OF FOCUS";
  let tx = W - M;
  for (let i = tag.length - 1; i >= 0; i--) {
    ctx.fillText(tag[i], tx, 92);
    tx -= ctx.measureText(tag[i]).width + 3;
  }
  ctx.textAlign = "left";

  // ---- center title ----
  ctx.fillStyle = INK;
  ctx.font = "900 84px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LOCKED IN", W / 2, 232);

  // thin rule under title
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 150, 258);
  ctx.lineTo(W / 2 + 150, 258);
  ctx.stroke();

  // ---- stats grid (2 x 2) ----
  const stats: [string, string][] = [
    ["TODAY", fmt(d.totalSeconds < d.weeklySeconds ? d.totalSeconds : d.weeklySeconds)],
    ["WEEKLY", fmt(d.weeklySeconds)],
    ["STREAK", `${d.streak.toString()} DAYS`],
    ["FOCUS SCORE", `${Math.min(100, Math.round((Number(d.weeklySeconds) * 100) / (7 * 3600 * 8)))}%`],
  ];
  const gw = (W - 2 * M - 48) / 2;
  const gh = 120;
  const gx0 = M;
  const gy0 = 300;
  stats.forEach(([label, val], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gx0 + col * (gw + 48);
    const y = gy0 + row * (gh + 24);
    // panel
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, gw, gh);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, gw, gh);
    // label
    ctx.fillStyle = INK_FAINT;
    ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, x + 22, y + 38);
    // value (prominent)
    ctx.fillStyle = INK;
    ctx.font = "900 46px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(val, x + 22, y + 92);
  });

  // ---- badges row ----
  const by = gy0 + 2 * (gh + 24) + 8;
  ctx.fillStyle = INK_FAINT;
  ctx.font = "700 16px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("BADGES", M, by + 18);
  const bw = 44;
  d.badges.forEach((b, i) => {
    const x = M + i * (bw + 12);
    ctx.strokeStyle = b.got ? ACCENT : LINE;
    ctx.lineWidth = b.got ? 2 : 1;
    ctx.strokeRect(x, by + 30, bw, bw);
    if (b.got) {
      ctx.fillStyle = INK;
      ctx.font = "900 26px 'Arial Black', Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("✓", x + bw / 2, by + 30 + 32);
      ctx.textAlign = "left";
    }
  });

  // ---- bottom: handle + wallet (mono) ----
  ctx.fillStyle = INK;
  ctx.font = "800 24px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "left";
  const handle = d.handle ? `@${d.handle}` : "anon";
  ctx.fillText(handle, M, H - 56);

  ctx.fillStyle = INK_DIM;
  ctx.font = "500 20px 'SFMono-Regular', Consolas, 'Liberation Mono', monospace";
  ctx.textAlign = "right";
  const short = d.wallet.length > 14 ? `${d.wallet.slice(0, 8)}…${d.wallet.slice(-6)}` : d.wallet;
  ctx.fillText(short, W - M, H - 56);

  // footer tag line (faint)
  ctx.fillStyle = INK_FAINT;
  ctx.font = "600 15px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("MONAD TESTNET · WALLET = IDENTITY · COMMIT-REVEAL PROOF", W / 2, H - 30);

  return canvas.toDataURL("image/png");
}

// Convert dataURL -> Blob (for clipboard / download)
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
