"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useReadContract, useWriteContract, useSignMessage, usePublicClient, useConnect, useDisconnect } from "wagmi";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { FOCUSPROOF_ADDRESS, FOCUSPROOF_ABI, BADGE_META, MONANIMAL_NAMES } from "../lib/abi";
import { WALLET_PICKER } from "../lib/wagmi";
import { renderFokusCard, dataUrlToBlob, type CardBadge } from "../lib/card";
import { monadTestnet } from "../lib/wagmi";

type Progress = {
  totalSeconds: bigint;
  weeklySeconds: bigint;
  streak: bigint;
  xp: bigint;
  level: bigint;
  sessionCount: bigint;
};

const fmt = (s: bigint) => {
  const sec = Number(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};
const fmtPct = (focusSec: bigint, totalSec: bigint) => {
  if (totalSec === 0n) return 0;
  return Math.min(100, Math.round((Number(focusSec) * 100) / Number(totalSec)));
};
// Percentage-based display: 1 hour = 100%, rest scales from that base.
const fmtHourPct = (seconds: number) => Math.round((seconds / 3600) * 100);

const shortAddr = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-2)}` : "");

const themes = {
  dark: {
    bg: "#0E091C", card: "#17102B", card2: "#1c1436", border: "#2A2145",
    text: "#F3F1FF", muted: "#9A8FC4", accent: "#6E54FF",
    grad: "linear-gradient(160deg, #6E54FF 0%, #2a1f66 35%, #0E091C 75%)",
  },
  light: {
    bg: "#F7F5FF", card: "#FFFFFF", card2: "#F1EDFF", border: "#E3DBFF",
    text: "#1B1330", muted: "#7A6FA0", accent: "#6E54FF",
    grad: "linear-gradient(160deg, #6E54FF 0%, #b7a8ff 35%, #ffffff 75%)",
  },
} as const;

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();

  // Open wallet picker modal instead of auto-connecting.
  const connectWallet = () => setShowWalletPicker(true);

  const pickConnector = async (id: string) => {
    setShowWalletPicker(false);
    const c = connectors.find((x) => x.id === id) || connectors[0];
    try {
      await connect({ connector: c });
    } catch (e: any) {
      setMsg("❌ " + (e?.shortMessage || e?.message || "wallet connection failed"));
    }
  };
  const { disconnect } = useDisconnect();
  const { writeContract, writeContractAsync, isPending } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [authed, setAuthed] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [badges, setBadges] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"focus" | "progress" | "pet" | "profile" | "settings">("focus");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [durMin, setDurMin] = useState(60);
  const [dur, setDur] = useState(60 * 60);
  const [left, setLeft] = useState(60 * 60);
  const [logging, setLogging] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  // load saved custom pfp from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("fokusle_pfp");
      if (saved) setCustomAvatar(saved);
    } catch {}
  }, []);

  const saveCustomAvatar = (dataUrl: string | null) => {
    setCustomAvatar(dataUrl);
    try {
      if (dataUrl) window.localStorage.setItem("fokusle_pfp", dataUrl);
      else window.localStorage.removeItem("fokusle_pfp");
    } catch {}
  };

  const { data: progData, refetch: refetchProg } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "getProgress",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { data: badgeData, refetch: refetchBadge } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "getBadges",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  useEffect(() => {
    if (progData) {
      const p = progData as unknown as bigint[];
      setProg({
        totalSeconds: p[0] ?? 0n,
        weeklySeconds: p[1] ?? 0n,
        streak: p[2] ?? 0n,
        xp: p[3] ?? 0n,
        level: p[4] ?? 0n,
        sessionCount: p[5] ?? 0n,
      });
    }
    if (badgeData) setBadges(badgeData as bigint[] as unknown as number[]);
  }, [progData, badgeData]);

  const [insights, setInsights] = useState<{
    loading: boolean;
    totalSessions: number;
    avgSessionMin: number;
    longestSessionMin: number;
    mostActivePeriod: string;
    mostActiveDay: string;
    avgGapHours: number | null;
    last7Days: number[]; // seconds focused per day, oldest to newest, index 0 = 6 days ago
  } | null>(null);

  const publicClient = usePublicClient();

  const loadInsights = useCallback(async () => {
    if (!address || !publicClient) return;
    setInsights((prev) => ({ ...(prev as any), loading: true }));
    try {
      const logs = await publicClient.getLogs({
        address: FOCUSPROOF_ADDRESS,
        event: FOCUSPROOF_ABI.find((e: any) => e.type === "event" && e.name === "SessionLogged") as any,
        args: { user: address },
        fromBlock: 0n,
        toBlock: "latest",
      });

      if (logs.length === 0) {
        setInsights({
          loading: false, totalSessions: 0, avgSessionMin: 0, longestSessionMin: 0,
          mostActivePeriod: "-", mostActiveDay: "-", avgGapHours: null, last7Days: [0, 0, 0, 0, 0, 0, 0],
        });
        return;
      }

      // fetch block timestamps for each log (dedup by block)
      const blockNums = Array.from(new Set(logs.map((l) => l.blockNumber!)));
      const blocks = await Promise.all(blockNums.map((bn) => publicClient.getBlock({ blockNumber: bn })));
      const tsByBlock = new Map(blocks.map((b) => [b.number, Number(b.timestamp)]));

      const sessions = logs.map((l) => ({
        seconds: Number((l.args as any).secondsFocused),
        ts: tsByBlock.get(l.blockNumber!)!,
      })).sort((a, b) => a.ts - b.ts);

      const periodBuckets = [0, 0, 0, 0]; // night(0-6) morning(6-12) afternoon(12-18) evening(18-24)
      const dayBuckets = [0, 0, 0, 0, 0, 0, 0]; // Sun..Sat
      let totalSec = 0;
      let longest = 0;

      // real last-7-days totals, bucketed by UTC calendar day
      const now = Math.floor(Date.now() / 1000);
      const todayStart = now - (now % 86400);
      const last7Days = [0, 0, 0, 0, 0, 0, 0]; // index 6 = today, 0 = 6 days ago

      for (const s of sessions) {
        const d = new Date(s.ts * 1000);
        const hour = d.getUTCHours();
        const day = d.getUTCDay();
        periodBuckets[Math.floor(hour / 6)]++;
        dayBuckets[day]++;
        totalSec += s.seconds;
        if (s.seconds > longest) longest = s.seconds;

        const daysAgo = Math.floor((todayStart - (s.ts - (s.ts % 86400))) / 86400);
        if (daysAgo >= 0 && daysAgo <= 6) last7Days[6 - daysAgo] += s.seconds;
      }

      const periodLabels = ["Night (00–06)", "Morning (06–12)", "Afternoon (12–18)", "Evening (18–24)"];
      const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const mostActivePeriod = periodLabels[periodBuckets.indexOf(Math.max(...periodBuckets))];
      const mostActiveDay = dayLabels[dayBuckets.indexOf(Math.max(...dayBuckets))];

      let avgGapHours: number | null = null;
      if (sessions.length > 1) {
        const gaps = sessions.slice(1).map((s, i) => s.ts - sessions[i].ts);
        avgGapHours = gaps.reduce((a, b) => a + b, 0) / gaps.length / 3600;
      }

      setInsights({
        loading: false,
        totalSessions: sessions.length,
        avgSessionMin: Math.round(totalSec / sessions.length / 60),
        longestSessionMin: Math.round(longest / 60),
        mostActivePeriod,
        mostActiveDay,
        avgGapHours,
        last7Days,
      });
    } catch (e) {
      setInsights({
        loading: false, totalSessions: 0, avgSessionMin: 0, longestSessionMin: 0,
        mostActivePeriod: "-", mostActiveDay: "-", avgGapHours: null, last7Days: [0, 0, 0, 0, 0, 0, 0],
      });
    }
  }, [address, publicClient]);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  const [nnsProfile, setNnsProfile] = useState<{ primaryName: string | null; avatar: string | null } | null>(null);

  useEffect(() => {
    if (!address || !publicClient) return;
    (async () => {
      try {
        // NNS (Nad Name Service) core contract on Monad Testnet.
        // Verified from https://docs.nad.domains/developers/contracts/contract-addresses
        const nnsAddress = "0x3019BF1dfB84E5b46Ca9D0eEC37dE08a59A41308" as `0x${string}`;
        const nnsAbi = [
          {
            type: "function",
            name: "getProfilesForAddresses",
            stateMutability: "view",
            inputs: [{ name: "addrs", type: "address[]" }],
            outputs: [
              {
                type: "tuple[]",
                components: [
                  { name: "addr", type: "address" },
                  { name: "primaryName", type: "string" },
                  { name: "avatar", type: "string" },
                ],
              },
            ],
          },
        ] as const;
        const result = await publicClient.readContract({
          address: nnsAddress,
          abi: nnsAbi,
          functionName: "getProfilesForAddresses",
          args: [[address]],
        } as any);
        const p = (result as any)[0];
        setNnsProfile({
          primaryName: p?.primaryName || null,
          avatar: p?.avatar || null,
        });
      } catch {
        setNnsProfile({ primaryName: null, avatar: null });
      }
    })();
  }, [address, publicClient]);

  const { data: nicknameData, refetch: refetchNickname } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "nickname",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const [nicknameInput, setNicknameInput] = useState("");
  const [nicknameSaving, setNicknameSaving] = useState(false);

  const { data: gachaPullsData, refetch: refetchGachaPulls } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "getGachaPulls",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const [gachaPulling, setGachaPulling] = useState(false);
  const [gachaResult, setGachaResult] = useState<string | null>(null);
  const [gachaError, setGachaError] = useState<string | null>(null);

  const pullGacha = async () => {
    if (!address) return;
    setGachaPulling(true);
    setGachaError(null);
    setGachaResult(null);
    try {
      writeContract({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        functionName: "pullGacha",
        account: address,
        chain: monadTestnet,
      });
      // result comes back via the GachaPulled event / refetch, not a direct return value here
      setTimeout(() => {
        refetchGachaPulls();
        setGachaPulling(false);
      }, 4000);
    } catch (e: any) {
      setGachaError(e?.shortMessage || "Pull failed — check you have enough XP.");
      setGachaPulling(false);
    }
  };

  const saveNickname = async () => {
    if (!nicknameInput.trim()) return;
    setNicknameSaving(true);
    try {
      writeContract({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        functionName: "setNickname",
        args: [nicknameInput.trim().slice(0, 20)],
        account: address,
        chain: monadTestnet,
      });
      setTimeout(() => refetchNickname(), 3000);
    } finally {
      setNicknameSaving(false);
    }
  };

  // Display name priority: .nad name > custom nickname > truncated address
  const displayName =
    nnsProfile?.primaryName ||
    (nicknameData as string) ||
    (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "");


  const { data: leaderboardAddrs } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "getLeaderboard",
    query: { refetchInterval: 10000 },
  });

  const [leaderboard, setLeaderboard] = useState<{ addr: string; streak: number; name: string }[]>([]);

  useEffect(() => {
    if (!leaderboardAddrs || !publicClient || (leaderboardAddrs as string[]).length === 0) return;
    (async () => {
      const addrs = (leaderboardAddrs as `0x${string}`[]).slice(0, 20);
      try {
        const streaks = await publicClient.readContract({
          address: FOCUSPROOF_ADDRESS,
          abi: FOCUSPROOF_ABI,
          functionName: "getStreaks",
          args: [addrs],
        } as any) as bigint[];

        let names: (string | null)[] = addrs.map(() => null);
        try {
          const nnsAddress = "0x3019BF1dfB84E5b46Ca9D0eEC37dE08a59A41308" as `0x${string}`;
          const nnsAbi = [{
            type: "function", name: "getProfilesForAddresses", stateMutability: "view",
            inputs: [{ name: "addrs", type: "address[]" }],
            outputs: [{ type: "tuple[]", components: [
              { name: "addr", type: "address" }, { name: "primaryName", type: "string" }, { name: "avatar", type: "string" },
            ]}],
          }] as const;
          const profiles = await publicClient.readContract({
            address: nnsAddress, abi: nnsAbi, functionName: "getProfilesForAddresses", args: [addrs],
          } as any) as any[];
          names = profiles.map((p) => p?.primaryName || null);
        } catch {}

        const rows = addrs.map((a, i) => ({
          addr: a,
          streak: Number(streaks[i] ?? 0n),
          name: names[i] || `${a.slice(0, 4)}…${a.slice(-2)}`,
        })).sort((a, b) => b.streak - a.streak);

        setLeaderboard(rows);
      } catch {
        setLeaderboard([]);
      }
    })();
  }, [leaderboardAddrs, publicClient]);

  const signIn = useCallback(async () => {
    if (!address) return;
    try {
      await signMessageAsync({ account: address, message: `FokusLe login\nWallet: ${address}\nSign to prove ownership.` });
      setAuthed(true);
      setMsg("");
    } catch {
      setMsg("❌ Sign cancelled.");
    }
  }, [address, signMessageAsync]);

  // timer
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          clearInterval(t);
          setRunning(false);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const startSession = async () => {
    // NO onchain tx — just start the local timer. Data is only written on finish/log.
    setStarted(true);
    setRunning(true);
    setLeft(dur);
    setMsg("🔒 Locked in. Focus now.");
  };

  const logSession = async () => {
    if (!address) return;
    const focused = BigInt(dur - left);
    if (focused <= 0n) { setMsg("⚠️ Timer belum selesai."); return; }
    setLogging(true);
    setMsg("");
    try {
      await writeContractAsync({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        functionName: "logFocus",
        args: [focused],
        account: address,
        chain: monadTestnet,
      } as any);
      // wait for receipt + refetch onchain progress
      await refetchProg();
      await refetchBadge();
      setRunning(false);
      setStarted(false);
      setShowShare(true); // show share modal AFTER successful log
      setMsg("✅ Session logged onchain.");
    } catch (e: any) {
      setMsg("❌ " + (e?.shortMessage || e?.message));
    } finally {
      setLogging(false);
    }
  };

  const shareText = () => {
    if (!prog) return "";
    return `🔒 LOCKED IN\n\nToday\n${fmt(prog.weeklySeconds < prog.totalSeconds ? prog.weeklySeconds : prog.totalSeconds)}\n\nWeekly\n${fmt(prog.weeklySeconds)}\n\nCurrent Streak\n${prog.streak} Days\n\nFocus Score\n${fmtPct(prog.weeklySeconds, 7n * 3600n * 8n)}%\n\nWallet\n${address?.slice(0, 6)}…${address?.slice(-4)}\n\n#ProofOfFocus #FokusLe`;
  };
  const share = (platform: string) => {
    const text = shareText();
    if (platform === "dc") {
      navigator.clipboard.writeText(text);
      downloadCard();
      setMsg("📋 Lock-In card copied + downloaded — paste to Discord.");
      return;
    }
    // X: text-only redirect + auto-download flex card PNG (user attaches manually)
    downloadCard();
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadCard = async () => {
    if (!prog) return;
    const bgs: CardBadge[] = Object.values(BADGE_META).map((b, i) => ({
      name: b.name,
      got: badges.includes(i + 1),
    }));
    const dataUrl = await renderFokusCard({
      handle: displayName,
      wallet: address || "",
      weeklySeconds: prog.weeklySeconds,
      totalSeconds: prog.totalSeconds,
      streak: prog.streak,
      xp: prog.xp,
      level: prog.level,
      badges: bgs,
      avatarUrl: customAvatar || undefined,
    });
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fokusle-lockedin-${address?.slice(0, 6)}.png`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("🖼️ Lock-In Card downloaded.");
  };

  const cardToday = fmt(prog?.weeklySeconds ?? 0n);
  const T = themes[theme];
  // theme-aware ghost button colors (fix light-mode white-on-white)
  const GHOST = theme === "dark"
    ? { bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.35)", text: "#fff" }
    : { bg: "rgba(110,84,255,0.08)", border: "rgba(110,84,255,0.35)", text: "#3a2f66" };
  const GRID = theme === "dark"
    ? "linear-gradient(rgba(110,84,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(110,84,255,0.06) 1px, transparent 1px)"
    : "linear-gradient(rgba(110,84,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(110,84,255,0.05) 1px, transparent 1px)";
  const sessionPct = fmtHourPct(Math.max(0, dur - left));
  const targetPct = fmtHourPct(dur);

  const S = {
    device: { width: 390, minHeight: 780, background: theme === "dark" ? "rgba(14,9,28,0.72)" : "rgba(247,245,255,0.85)", backdropFilter: "blur(14px)", color: T.text, borderRadius: 28, overflow: "hidden", margin: "20px auto", fontFamily: "'Inter', -apple-system, sans-serif", position: "relative" as const, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.45)" },
    screen: { padding: "16px 20px 90px", minHeight: 700 },
    hero: { background: "linear-gradient(160deg, rgba(110,84,255,0.20) 0%, rgba(42,31,102,0.10) 50%, transparent 100%)", border: "1px solid rgba(110,84,255,0.35)", borderRadius: 24, padding: "22px 20px 26px", marginBottom: 16, boxShadow: "0 8px 30px rgba(110,84,255,0.10)" },
    card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12, backdropFilter: "blur(6px)" },
    sectionTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" } as const,
    sectionH3: { fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: 0.3 } as const,
    chip: (active: boolean) => ({ flex: 1, textAlign: "center" as const, background: active ? "#fff" : GHOST.bg, color: active ? T.accent : GHOST.text, fontSize: 12, fontWeight: 600, padding: "8px 0 6px", borderRadius: 14, cursor: "pointer", border: "none" }),
    tabbar: { position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 64, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-around", backdropFilter: "blur(10px)" },
    tab: (active: boolean) => ({ color: active ? "#fff" : T.muted, background: active ? "linear-gradient(150deg,#8b7bff,#6E54FF)" : "transparent", fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10, cursor: "pointer", border: "none", fontFamily: "'Inter', sans-serif", boxShadow: active ? "0 4px 14px rgba(110,84,255,0.35)" : "none" }),
    feedItem: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` },
    streakTag: { marginLeft: "auto", background: T.card2, color: T.accent, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, fontFamily: "'Roboto Mono', monospace" },
  };

  return (
    <div style={{ background: theme === "dark" ? "#0a0712" : "#eee9ff", minHeight: "100vh", padding: "20px 0", backgroundImage: GRID, backgroundSize: "26px 26px" }}>
      <div style={S.device as any}>
        <div style={S.screen}>
          {!isConnected ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 640, textAlign: "center", padding: "0 16px" }}>
              <div style={{ width: 76, height: 76, borderRadius: 22, background: "linear-gradient(150deg,#8b7bff,#6E54FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 32, color: "#fff", fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 12px 30px rgba(110,84,255,0.4)", marginBottom: 18 }}>F</div>
              <h2 style={{ fontSize: 24, margin: "0 0 6px", fontFamily: "'Space Grotesk', sans-serif", color: T.text }}>FokusLe</h2>
              <p style={{ color: T.muted, fontSize: 13, margin: "0 0 30px", lineHeight: 1.5 }}>Proof of Focus. Proof of Discipline.<br />Connect your wallet to start a session.</p>
              <button onClick={connectWallet} style={{ width: "100%", background: "linear-gradient(150deg,#8b7bff,#6E54FF)", color: "#fff", border: "none", padding: "14px 24px", borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 8px 24px rgba(110,84,255,0.35)" }}>
                {isConnectPending ? "Connecting..." : "Connect Wallet"}
              </button>
              <p style={{ color: T.muted, fontSize: 11, marginTop: 10 }}>Choose your wallet to begin.</p>
            </div>
          ) : !authed ? (
            <div style={{ ...S.card, marginTop: 60, textAlign: "center" }}>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: T.muted }}>{shortAddr(address)}</p>
              <button style={{ width: "100%", background: "linear-gradient(150deg,#8b7bff,#6E54FF)", color: "#fff", border: "none", padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 24px rgba(110,84,255,0.3)" }} onClick={signIn}>
                Sign in
              </button>
            </div>
          ) : (
            <>
              {msg && <div style={{ background: T.card2, border: `1px solid ${T.border}`, color: T.text, padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 12 }}>{msg}</div>}

              {/* FOCUS TAB */}
              {tab === "focus" && (
                <>
                  <div style={S.hero}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: "linear-gradient(150deg,#8b7bff,#6E54FF)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#fff", fontFamily: "'Space Grotesk', sans-serif" }}>F</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }}>FokusLe</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: GHOST.bg, borderRadius: 999, padding: "5px 10px 5px 6px" }}>
                        <div style={{ width: 7, height: 7, borderRadius: 999, background: "#4ADE80" }} />
                        <div style={{ fontSize: 11, fontWeight: 600, color: GHOST.text }}>{displayName}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 10px", position: "relative" }}>
                      <svg width="200" height="200" viewBox="0 0 200 200">
                        <defs>
                          <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b7bff" />
                            <stop offset="100%" stopColor="#6E54FF" />
                          </linearGradient>
                        </defs>
                        <circle cx="100" cy="100" r="86" stroke="rgba(255,255,255,0.12)" strokeWidth="14" fill="none" />
                        <circle cx="100" cy="100" r="86" stroke="url(#ring)" strokeWidth="14" fill="none"
                          strokeDasharray={540} strokeDashoffset={540 - (540 * Math.min(sessionPct, 100)) / 100}
                          strokeLinecap="round" transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1s linear", filter: "drop-shadow(0 0 6px rgba(110,84,255,0.5))" }} />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
                        <div style={{ fontSize: 40, fontWeight: 700, color: "#fff", fontFamily: "'Roboto Mono', monospace" }}>
                          {running ? `${sessionPct}%` : "0%"}
                        </div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                          60 min = 100%
                        </div>
                      </div>
                    </div>

                    {/* duration input (user sets any minutes they want) */}
                    {!running && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>Focus for</span>
                        <input
                          type="number"
                          min={1}
                          max={1440}
                          value={durMin}
                          onChange={(e) => {
                            const m = Math.max(1, Math.min(1440, Number(e.target.value) || 1));
                            setDurMin(m);
                            setDur(m * 60);
                            setLeft(m * 60);
                          }}
                          style={{ width: 64, background: GHOST.bg, border: `1px solid ${T.border}`, color: GHOST.text, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontFamily: "'Roboto Mono', monospace", textAlign: "center" }}
                        />
                        <span style={{ fontSize: 12, color: T.muted }}>min</span>
                      </div>
                    )}

                    {!started ? (
                      <button style={{ width: "100%", background: "linear-gradient(150deg,#8b7bff,#6E54FF)", color: "#fff", border: "none", padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 15, marginTop: 14, cursor: "pointer", boxShadow: "0 8px 24px rgba(110,84,255,0.35)" }} onClick={startSession}>
                        Lock in
                      </button>
                    ) : running ? (
                      <button style={{ width: "100%", background: GHOST.bg, color: GHOST.text, border: `1px solid ${GHOST.border}`, padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 15, marginTop: 14, cursor: "pointer", backdropFilter: "blur(6px)" }} onClick={() => setRunning(false)}>
                        Pause
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                        <button style={{ flex: 1, background: GHOST.bg, color: GHOST.text, border: `1px solid ${GHOST.border}`, padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", backdropFilter: "blur(6px)" }} onClick={() => setRunning(true)}>
                          Resume
                        </button>
                        <button style={{ flex: 1, background: "linear-gradient(150deg,#8b7bff,#6E54FF)", color: "#fff", border: "none", padding: 14, borderRadius: 14, fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 24px rgba(110,84,255,0.35)" }} onClick={logSession} disabled={isPending || logging}>
                          Finish
                        </button>
                      </div>
                    )}
                    <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 10, fontFamily: "'Roboto Mono', monospace" }}>60 min = 100%, always · Finish = onchain fee</div>
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Top streaks</h3><span style={{ fontSize: 11, color: T.accent, fontWeight: 600, cursor: "pointer" }} onClick={() => setTab("progress")}>See all</span></div>
                  <div style={S.card}>
                    {leaderboard.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No sessions logged yet on this contract.</div>
                    ) : (
                      leaderboard.slice(0, 3).map((row, i) => {
                        const isMe = row.addr.toLowerCase() === address?.toLowerCase();
                        const av = isMe && customAvatar ? customAvatar : `https://api.dicebear.com/7.x/shapes/svg?seed=${row.addr}`;
                        return (
                        <div key={row.addr} style={{ ...S.feedItem, borderBottom: i === Math.min(2, leaderboard.length - 1) ? "none" : S.feedItem.borderBottom }}>
                          <img src={av} style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, border: "1px solid rgba(110,84,255,0.4)", objectFit: "cover" }} />
                          <div><b style={{ fontSize: 13 }}>{i + 1}. {row.name}{isMe ? " (You)" : ""}</b></div>
                          <div style={S.streakTag}>{row.streak}d</div>
                        </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* PROGRESS + BADGES TAB */}
              {tab === "progress" && prog && (
                <>
                  <div style={{ ...S.card, display: "flex", gap: 10 }}>
                    <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{fmtHourPct(Number(prog.totalSeconds))}%</div><div style={{ fontSize: 10, color: T.muted }}>Total ({fmt(prog.totalSeconds)})</div></div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{String(prog.sessionCount)}</div><div style={{ fontSize: 10, color: T.muted }}>Sessions</div></div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{insights && insights.avgSessionMin ? `${fmtHourPct(insights.avgSessionMin * 60)}%` : "-"}</div><div style={{ fontSize: 10, color: T.muted }}>Avg / session</div></div>
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Last 7 days</h3></div>
                  <div style={S.card}>
                    {insights?.last7Days ? insights.last7Days.map((sec, i) => {
                      const dayNames = ["-6d", "-5d", "-4d", "-3d", "-2d", "Yest.", "Today"];
                      const pct = fmtHourPct(sec);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i === 6 ? 0 : 9 }}>
                          <div style={{ width: 40, fontSize: 11, color: T.muted }}>{dayNames[i]}</div>
                          <div style={{ flex: 1, height: 8, background: T.card2, borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: T.accent, borderRadius: 999 }} />
                          </div>
                          <div style={{ width: 40, fontSize: 11, textAlign: "right", color: T.muted, fontFamily: "'Roboto Mono', monospace" }}>{pct}%</div>
                        </div>
                      );
                    }) : <div style={{ color: T.muted, fontSize: 12 }}>Loading…</div>}
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Leaderboard</h3></div>
                  <div style={S.card}>
                    {leaderboard.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Nobody has logged a session yet — be first.</div>
                    ) : leaderboard.slice(0, 10).map((row, i) => {
                      const isMe = row.addr.toLowerCase() === address?.toLowerCase();
                      const av = isMe && customAvatar ? customAvatar : `https://api.dicebear.com/7.x/shapes/svg?seed=${row.addr}`;
                      return (
                      <div key={row.addr} style={S.feedItem}>
                        <img src={av} style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, border: "1px solid rgba(110,84,255,0.4)", objectFit: "cover" }} />
                        <div><b style={{ fontSize: 13 }}>{i + 1}. {row.name}{isMe ? " (You)" : ""}</b></div>
                        <div style={S.streakTag}>{row.streak}d</div>
                      </div>
                      );
                    })}
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Badges</h3></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[1, 2, 3, 4, 5].map((id) => {
                      const owned = badges.includes(id);
                      const m = BADGE_META[id];
                      return (
                        <div key={id} style={{ ...S.card, textAlign: "center", opacity: owned ? 1 : 0.4, marginBottom: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{owned ? "Unlocked" : "Locked"}</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* PET TAB */}
              {tab === "pet" && (
                <>
                  <div style={{ ...S.card, textAlign: "center", padding: "36px 20px" }}>
                    <h2 style={{ fontSize: 17, margin: "0 0 8px", fontFamily: "'Space Grotesk', sans-serif" }}>Focus Pet</h2>
                    <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>The companion that grows and reacts to your streak is still coming. Gacha pulls are live now, ahead of it.</p>
                  </div>

                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <b style={{ fontSize: 13 }}>Monanimal Gacha</b>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted, fontFamily: "'Roboto Mono', monospace" }}>{prog ? String(prog.xp) : 0} XP</span>
                    </div>
                    <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, margin: "0 0 14px" }}>
                      Spend 50 XP for a cosmetic pull. Purely cosmetic — no gameplay advantage, not a tradeable token.
                    </p>
                    <button
                      onClick={pullGacha}
                      disabled={gachaPulling || !prog || prog.xp < 50n}
                      style={{ width: "100%", background: T.accent, color: "#fff", border: "none", padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: (!prog || prog.xp < 50n) ? 0.5 : 1 }}
                    >
                      {gachaPulling ? "Pulling…" : "Pull (50 XP)"}
                    </button>
                    {gachaError && <div style={{ color: "#ff9b9b", fontSize: 11, marginTop: 8 }}>{gachaError}</div>}
                    {(!prog || prog.xp < 50n) && !gachaError && (
                      <div style={{ color: T.muted, fontSize: 11, marginTop: 8 }}>Log a focus session to earn XP first (1 XP per minute).</div>
                    )}
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Your pulls</h3></div>
                  <div style={S.card}>
                    {!gachaPullsData || (gachaPullsData as bigint[]).length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>No pulls yet.</div>
                    ) : (
                      (gachaPullsData as bigint[]).map((id, i) => (
                        <div key={i} style={{ ...S.feedItem, borderBottom: i === (gachaPullsData as bigint[]).length - 1 ? "none" : S.feedItem.borderBottom }}>
                          <div><b style={{ fontSize: 13 }}>{MONANIMAL_NAMES[Number(id)] || `Monanimal #${Number(id)}`}</b></div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ color: T.muted, fontSize: 10, textAlign: "center", marginTop: -4, marginBottom: 12 }}>
                    Artwork not included yet — Monanimal characters shown as names only.
                  </div>
                </>
              )}

              {/* PROFILE TAB */}
              {tab === "profile" && (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: T.card2, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => setTab("settings")}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 112.83 2.83l.06-.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                    </div>
                  </div>
                  <div style={{ ...S.card, textAlign: "center", background: "linear-gradient(160deg, rgba(110,84,255,0.12) 0%, rgba(42,31,102,0.06) 60%, transparent 100%)", border: "1px solid rgba(110,84,255,0.30)" }}>
                    <img src={customAvatar || nnsProfile?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${address}`} style={{ width: 64, height: 64, borderRadius: 999, margin: "0 auto 10px", display: "block", border: "2px solid rgba(110,84,255,0.5)", boxShadow: "0 6px 18px rgba(110,84,255,0.25)" }} />
                    <div style={{ fontWeight: 700, fontSize: 17, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }}>{displayName}</div>
                    <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{address}</div>
                  </div>

                  {!nnsProfile?.primaryName && (
                    <div style={S.card}>
                      <h3 style={{ ...S.sectionH3, marginBottom: 12 }}>Display name</h3>
                      <p style={{ color: T.muted, fontSize: 12, margin: "0 0 12px", lineHeight: 1.5 }}>No .nad name found for this wallet. Set a custom nickname instead — stored onchain.</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="Nickname (max 20 chars)" maxLength={20}
                          style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 13, outline: "none" }} />
                        <button onClick={saveNickname} disabled={nicknameSaving} style={{ background: T.accent, color: "#fff", border: "none", padding: "0 16px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                          {nicknameSaving ? "..." : "Save"}
                        </button>
                      </div>
                    </div>
                  )}

                  {prog && (
                    <div style={S.card}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{fmtHourPct(Number(prog.totalSeconds))}%</div><div style={{ fontSize: 10, color: T.muted }}>Total ({fmt(prog.totalSeconds)})</div></div>
                        <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Roboto Mono', monospace" }}>{String(prog.sessionCount)}</div><div style={{ fontSize: 10, color: T.muted }}>Sessions</div></div>
                      </div>
                    </div>
                  )}

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Habit insights</h3></div>
                  <div style={S.card}>
                    {!insights || insights.totalSessions === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12 }}>Log a few sessions to unlock insights.</div>
                    ) : (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span style={{ color: T.muted }}>Most active time</span><span style={{ fontWeight: 600 }}>{insights.mostActivePeriod}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span style={{ color: T.muted }}>Most consistent day</span><span style={{ fontWeight: 600 }}>{insights.mostActiveDay}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", fontSize: 13 }}><span style={{ color: T.muted }}>Longest session</span><span style={{ fontWeight: 600, fontFamily: "'Roboto Mono', monospace" }}>{fmtHourPct(insights.longestSessionMin * 60)}%</span></div>
                      </>
                    )}
                  </div>

                  {prog && (
                    <>
                      <div style={S.sectionTitle}><h3 style={S.sectionH3}>Lock-In Card</h3></div>
                      <div style={{ ...S.card, backgroundImage: T.grad, border: "none" }}>
                        <div style={{ color: T.text, fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>LOCKED IN</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                          <div><div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Roboto Mono', monospace" }}>{cardToday}</div><div style={{ fontSize: 11, color: T.muted }}>Today</div></div>
                          <div><div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Roboto Mono', monospace" }}>{prog ? `${prog.streak}d` : "0"} Days</div><div style={{ fontSize: 11, color: T.muted }}>Streak</div></div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                          <button onClick={() => share("x")} style={{ flex: 1, background: GHOST.bg, border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Share X</button>
                          <button onClick={() => share("tg")} style={{ flex: 1, background: GHOST.bg, border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Telegram</button>
                          <button onClick={downloadCard} style={{ flex: 1, background: T.accent, border: "none", color: "#fff", padding: 10, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Download</button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* SETTINGS TAB */}
              {tab === "settings" && (
                <>
                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Settings</h3><span style={{ fontSize: 11, color: T.accent, fontWeight: 600, cursor: "pointer" }} onClick={() => setTab("profile")}>Back</span></div>
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                      <span>Theme</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setTheme("dark")} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: theme === "dark" ? T.accent : "transparent", color: theme === "dark" ? "#fff" : T.muted, cursor: "pointer" }}>Dark</button>
                        <button onClick={() => setTheme("light")} style={{ fontSize: 11, padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: theme === "light" ? T.accent : "transparent", color: theme === "light" ? "#fff" : T.muted, cursor: "pointer" }}>Light</button>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", fontSize: 13 }}><span>Network</span><span style={{ color: T.muted }}>Monad Testnet</span></div>
                  </div>
                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Account</h3></div>
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
                      <img src={customAvatar || nnsProfile?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${address}`} style={{ width: 52, height: 52, borderRadius: 999, border: "2px solid rgba(110,84,255,0.5)", objectFit: "cover" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>Profile picture</div>
                        <div style={{ fontSize: 11, color: T.muted }}>Custom image saved on this device</div>
                      </div>
                      <label style={{ background: GHOST.bg, border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {customAvatar ? "Change" : "Upload"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const r = new FileReader();
                          r.onload = () => saveCustomAvatar(r.result as string);
                          r.readAsDataURL(f);
                        }} />
                      </label>
                      {customAvatar && (
                        <button onClick={() => saveCustomAvatar(null)} style={{ background: "transparent", border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: "8px 12px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Reset</button>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span>Nickname</span><span style={{ color: T.muted }}>{(nicknameData as string) || "Not set"}</span></div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", fontSize: 13 }}><span style={{ color: "#ff9b9b" }}>Sign out</span><span style={{ color: "#ff9b9b", cursor: "pointer" }} onClick={() => setAuthed(false)}>→</span></div>
                  </div>
                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>About</h3></div>
                  <div style={S.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}><span>Contract</span><a href={`https://testnet.monadvision.com/address/${FOCUSPROOF_ADDRESS}`} target="_blank" style={{ color: T.accent, textDecoration: "none" }}>View on Explorer</a></div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", fontSize: 13 }}><span>Version</span><span style={{ color: T.muted }}>v1.0.0</span></div>
                  </div>
                </>
              )}
            </>
          )}
          </div>

          {isConnected && authed && (
          <div style={S.tabbar}>
            <button style={S.tab(tab === "focus")} onClick={() => setTab("focus")}>Focus</button>
            <button style={S.tab(tab === "progress")} onClick={() => setTab("progress")}>Progress</button>
            <button style={S.tab(tab === "pet")} onClick={() => setTab("pet")}>Pet</button>
            <button style={S.tab(tab === "profile" || tab === "settings")} onClick={() => setTab("profile")}>Profile</button>
          </div>
        )}

        {showWalletPicker && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ width: 300, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, fontFamily: "'Space Grotesk', sans-serif" }}>Connect a wallet</div>
              <p style={{ color: T.muted, fontSize: 12, margin: "0 0 14px" }}>Pick how you want to sign in.</p>
              {WALLET_PICKER.map((w) => (
                <button
                  key={w.id}
                  onClick={() => pickConnector(w.id)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: GHOST.bg, border: `1px solid ${GHOST.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontSize: 22 }}>{w.emoji}</span>
                  <span style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{w.name}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{w.note}</div>
                  </span>
                </button>
              ))}
              <button onClick={() => setShowWalletPicker(false)} style={{ width: "100%", background: "transparent", color: T.muted, border: "none", padding: 10, fontSize: 13, cursor: "pointer", marginTop: 2 }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showShare && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ width: 300, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, fontFamily: "'Space Grotesk', sans-serif" }}>Session locked in</div>
              <p style={{ color: T.muted, fontSize: 12, margin: "0 0 16px", lineHeight: 1.5 }}>Your flex card is ready. Share it or keep it to yourself.</p>
              <button onClick={() => { share("x"); setShowShare(false); }} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", padding: 13, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 8 }}>
                Share to X
              </button>
              <button onClick={() => setShowShare(false)} style={{ width: "100%", background: "transparent", color: T.muted, border: "none", padding: 10, fontSize: 13, cursor: "pointer" }}>
                OK, just keep it
              </button>
            </div>
          </div>
        )}
      </div>

      <p style={{ textAlign: "center", color: "#555c6e", fontSize: 11, marginTop: -4 }}>
        FokusLe · Monad Testnet · Wallet = identity. Commit-reveal proof. No staking.
      </p>
    </div>
  );
}
