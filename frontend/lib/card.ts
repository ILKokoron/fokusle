// Client-side flex card renderer for Fokusle Lock-In Card.
// Split layout: left = FOCUS SCORE dominant + stats, right = LOCKED IN + avatar + quote.
// Purple theme, Space Grotesk font (brand). Pure canvas, returns PNG data URL.

export type CardBadge = { name: string; got: boolean };

export type FokusCardData = {
  handle: string;
  wallet: string;
  weeklySeconds: bigint;
  totalSeconds: bigint;
  streak: bigint;
  xp: bigint;
  level: bigint;
  badges: CardBadge[];
  avatarUrl?: string;
  dailySeconds?: bigint;     // focus time today (for daily Focus Score)
  prevDailySeconds?: bigint; // focus time yesterday (for +/- delta)
};

const W = 1200;
const H = 630;

const fmt = (s: bigint) => {
  const sec = Number(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

function defaultAvatar(wallet: string): string {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${wallet || "fokusle"}`;
}

// English lowercase schizo-hustler quotes, no emoji, no time (shown elsewhere).
// Dynamic by total hours: low = self-deprecating, high = praising the user.
function pickQuote(totalSec: number, streakDays: number): string {
  const hrs = totalSec / 3600;
  const st = streakDays;
  let body = "";
  if (hrs < 1) {
    const opts = [
      `they laughed when i opened the timer. i laughed when they closed the tab`,
      `day one. the void is watching and honestly it respects the attempt`,
      `i am not disciplined yet but i am louder about it than everyone i know`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 5) {
    const opts = [
      `the scroll demons are knocking. i gave them the silent treatment for hours`,
      `built a fortress of focus out of pure spite and mild dehydration`,
      `they said consistency is a myth. ${st} days in i am the myth now`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 20) {
    const opts = [
      `monad knows i did not break. the chain remembers what the world forgot`,
      `discipline is just revenge on your past self done daily until it apologizes`,
      `i traded the feed for the grind and the grind finally started talking back`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 60) {
    const opts = [
      `they scroll, they cope, they sleep. i am the protocol running on pure intent`,
      `the hustle is not a phase. it is the only language the future speaks`,
      `you are watching a man become an algorithm of discipline in real time`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else {
    const opts = [
      `ascended past the noise. what remains is the grind and the grind is family`,
      `the gods of focus made me their spokesperson and i did not even apply`,
      `untouchable now. the feed fears my silence and the chain celebrates my name`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  }
  return `"${body}....`;
}

const BG = "#0E091C";
const CARD = "#cfc6ff";
const INK = "#ffffff";
const ACCENT = "#8b7bff";
const DIM = "#9a8fff";
const LINE = "#3a2f66";
const SCORE_TXT = "#1a1230";
const QUOTE = "#c9c2ff"; // soft lavender, not white
const FONT = "'Space Grotesk', 'Inter', 'Helvetica Neue', sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(new Image());
    img.src = src;
  });
}

// ensure brand fonts are loaded before drawing (avoids ugly fallback)
async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("400 26px 'Space Grotesk'"),
      document.fonts.load("700 24px 'Space Grotesk'"),
      document.fonts.load("800 52px 'Space Grotesk'"),
      document.fonts.load("900 150px 'Space Grotesk'"),
    ]);
    await document.fonts.ready;
  } catch {
    // ignore, fallback to Inter/system
  }
}

export async function renderFokusCard(d: FokusCardData): Promise<string> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // ===== LEFT PANEL =====
  const leftW = W * 0.62;
  const M = 56;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText("Fokusle", M, 92);

  ctx.fillStyle = ACCENT;
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "right";
  const tag = "PROOF OF FOCUS";
  let tx = leftW - M;
  for (let i = tag.length - 1; i >= 0; i--) {
    ctx.fillText(tag[i], tx, 88);
    tx -= ctx.measureText(tag[i]).width + 3;
  }
  ctx.textAlign = "left";

  const scoreH = 200;
  const scoreY = 120;
  ctx.fillStyle = CARD;
  roundRect(ctx, M, scoreY, leftW - 2 * M, scoreH, 18);
  ctx.fill();
  ctx.fillStyle = SCORE_TXT;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("FOCUS SCORE", M + 36, scoreY + 50);
  // daily focus score vs 8h/day target; +/- delta vs yesterday
  const DAILY_TARGET = 8 * 3600;
  const score = Math.min(100, Math.round((Number(d.dailySeconds ?? 0n) * 100) / DAILY_TARGET));
  const prev = Math.min(100, Math.round((Number(d.prevDailySeconds ?? 0n) * 100) / DAILY_TARGET));
  const delta = score - prev;
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  ctx.font = `900 110px ${FONT}`;
  ctx.fillText(`${sign}${score}%`, M + 36, scoreY + scoreH - 22);

  const statY = scoreY + scoreH + 24;
  const statH = 96;
  const sw = (leftW - 2 * M - 32) / 3;
  const stats: [string, string][] = [
    ["TODAY", fmt(d.weeklySeconds)],
    ["WEEKLY", fmt(d.weeklySeconds)],
    ["STREAK", `${d.streak.toString()}D`],
  ];
  stats.forEach(([label, val], i) => {
    const x = M + i * (sw + 16);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    roundRect(ctx, x, statY, sw, statH, 14);
    ctx.stroke();
    ctx.fillStyle = DIM;
    ctx.font = `700 18px ${FONT}`;
    ctx.fillText(label, x + 18, statY + 32);
    ctx.fillStyle = INK;
    ctx.font = `800 36px ${FONT}`;
    ctx.fillText(val, x + 18, statY + 74);
  });

  const idY = H - 48;
  ctx.fillStyle = INK;
  ctx.font = `800 30px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(d.handle ? (d.handle.startsWith("@") ? d.handle : `@${d.handle}`) : "anon", M, idY);

  // ===== RIGHT PANEL =====
  const rx = leftW;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(rx, 20); ctx.lineTo(rx, H - 20); ctx.stroke();
  const rg = ctx.createLinearGradient(rx, 0, W, H);
  rg.addColorStop(0, "rgba(139,123,255,0.05)");
  rg.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = rg;
  ctx.fillRect(rx, 20, W - rx - 20, H - 40);

  const rcx = rx + (W - rx) / 2;

  ctx.fillStyle = ACCENT;
  ctx.font = `700 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("LOCKED IN", rcx, 60);

  const av = await loadImg(d.avatarUrl || defaultAvatar(d.wallet));
  const ar = 90;
  const ax = rcx - ar;
  const ay = 90;
  ctx.save();
  ctx.beginPath();
  ctx.arc(rcx, ay + ar, ar, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#1c1436";
  ctx.fill();
  ctx.clip();
  if (av.width > 0) {
    ctx.drawImage(av, ax, ay, ar * 2, ar * 2);
  } else {
    ctx.fillStyle = ACCENT;
    ctx.font = `800 70px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("F", rcx, ay + ar + 24);
  }
  ctx.restore();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(rcx, ay + ar, ar, 0, Math.PI * 2);
  ctx.stroke();

  const quote = pickQuote(Number(d.totalSeconds), Number(d.streak));
  ctx.fillStyle = QUOTE;
  ctx.font = `400 20px ${FONT}`;
  ctx.textAlign = "center";
  const lines = wrapText(ctx, quote, (W - rx) - 80);
  let qy = ay + ar * 2 + 44;
  const lh = 32;
  for (const ln of lines.slice(0, 7)) {
    ctx.fillText(ln, rcx, qy);
    qy += lh;
  }

  return canvas.toDataURL("image/png");
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
