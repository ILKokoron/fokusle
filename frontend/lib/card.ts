// Client-side flex card renderer for Fokusle Lock-In Card.
// Split layout: left = FOCUS SCORE dominant + stats, right = LOCKED IN + avatar + quote.
// Purple theme. Pure canvas, returns PNG data URL.

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
  avatarUrl?: string; // custom pfp (from gallery). falls back to dicebear(address)
};

const W = 1200;
const H = 630; // 1.9:1 split layout

const fmt = (s: bigint) => {
  const sec = Number(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

function defaultAvatar(wallet: string): string {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${wallet || "fokusle"}`;
}

// Quotes based on TOTAL focus hours. Lower = more self-deprecating,
// higher = praising the user. Written as normal lowercase sentences,
// wrapped in " ... " with trailing ....
function pickQuote(totalSec: number, streakDays: number): string {
  const hrs = totalSec / 3600;
  const st = streakDays;
  const t = fmt(BigInt(totalSec));
  let body = "";
  if (hrs < 1) {
    const opts = [
      `baru lock in ${t}, mereka bilang gak bakal tahan, mereka benar tapi ya udah`,
      `hari pertama grind. ${t} kecatat. detox dopamin mulai lagi (kemarin gagal)`,
      `${t} fokus hari ini. disiplin beneran katanya (tolong cek aku masih waras)`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 5) {
    const opts = [
      `${t} di chain. streak ${st} hari. mereka scroll, aku naik level pelan-pelan`,
      `total ${t} fokus. otakku hampir mesin sekarang, masih bocor dikit`,
      `streak ${st} hari. ${t} tercatat. algoritma mulai takut kayaknya`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 20) {
    const opts = [
      `${t} tercatat. streak ${st} hari. aku sudah jadi protokolnya. monad tahu`,
      `disiplin agama. ${t} kupanjatkan. ${st} hari streak. amin`,
      `${st} hari fokus murni. ${t}. mereka gak akan pernah dapet grind ini`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else if (hrs < 60) {
    const opts = [
      `level legenda: ${t} fokus. ${st} hari streak. kau standarnya sekarang`,
      `${t} disiplin. grind menghormati kau. terus bangun, king`,
      `${st} hari streak. ${t} di chain. kau wujudnya fokus`,
    ];
    body = opts[Math.floor(Math.random() * opts.length)];
  } else {
    const opts = [
      `ascended. ${t} disiplin murni. ${st} hari streak. kau contoh yang mereka kutip`,
      `${t} tercatat. kau gak patah. kau jadi grindnya. respek`,
      `${st} hari streak. ${t}. dewa fokus nangis. kau gak tersentuh`,
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
const SCORE_TXT = "#0a0a0a";

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
    img.onerror = () => resolve(new Image()); // empty -> skip
    img.src = src;
  });
}

export async function renderFokusCard(d: FokusCardData): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // background + grid
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // outer frame
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // ===== LEFT PANEL (62%) =====
  const leftW = W * 0.62;
  const M = 56;

  // wordmark + tag
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "800 52px 'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FokusLe", M, 92);

  ctx.fillStyle = ACCENT;
  ctx.font = "700 20px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "right";
  const tag = "PROOF OF FOCUS";
  let tx = leftW - M;
  for (let i = tag.length - 1; i >= 0; i--) {
    ctx.fillText(tag[i], tx, 88);
    tx -= ctx.measureText(tag[i]).width + 3;
  }
  ctx.textAlign = "left";

  // focus score card (dominant)
  const scoreH = 200;
  const scoreY = 120;
  ctx.fillStyle = CARD;
  roundRect(ctx, M, scoreY, leftW - 2 * M, scoreH, 18);
  ctx.fill();
  ctx.fillStyle = SCORE_TXT;
  ctx.font = "700 24px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOCUS SCORE", M + 36, scoreY + 50);
  const score = Math.min(100, Math.round((Number(d.weeklySeconds) * 100) / (7 * 3600 * 8)));
  ctx.font = "900 150px 'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(`${score}%`, M + 36, scoreY + scoreH - 30);

  // stat cards (3 cols)
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
    ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(label, x + 18, statY + 32);
    ctx.fillStyle = INK;
    ctx.font = "800 36px 'Inter', 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(val, x + 18, statY + 74);
  });

  // identity (bottom left): username only
  const idY = H - 48;
  ctx.fillStyle = INK;
  ctx.font = "800 30px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(d.handle ? `@${d.handle}` : "anon", M, idY);

  // ===== RIGHT PANEL (38%) =====
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

  // LOCKED IN header
  ctx.fillStyle = ACCENT;
  ctx.font = "700 22px 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LOCKED IN", rcx, 60);

  // avatar (circular)
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
    ctx.font = "800 70px 'Inter', 'Helvetica Neue', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("F", rcx, ay + ar + 24);
  }
  ctx.restore();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(rcx, ay + ar, ar, 0, Math.PI * 2);
  ctx.stroke();

  // quote (dynamic, lowercase, wrapped in quotes)
  const quote = pickQuote(Number(d.totalSeconds), Number(d.streak));
  ctx.fillStyle = INK;
  ctx.font = "400 26px 'Inter', 'Helvetica Neue', Arial, sans-serif";
  ctx.textAlign = "center";
  const lines = wrapText(ctx, quote, (W - rx) - 80);
  let qy = ay + ar * 2 + 44;
  const lh = 30;
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
