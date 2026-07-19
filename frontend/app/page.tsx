"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAccount, useReadContract, useWriteContract, useSignMessage, usePublicClient, useDisconnect } from "wagmi";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from "viem";
import { FOCUSPROOF_ADDRESS, FOCUSPROOF_ABI, BADGE_META, MONANIMAL_NAMES } from "../lib/abi";
import { monadTestnet } from "../lib/wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { renderFokusCard, dataUrlToBlob, type CardBadge } from "../lib/card";


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

const fmtClock = (total: number) => {
  const s = Math.max(0, Math.floor(total));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
};
const shortAddr = (a?: string) => (a ? `${a.slice(0, 4)}…${a.slice(-2)}` : "");

// Schizohustler bio templates — static (no AI cost), picked by time-of-day bucket
// + a hash of the address so each wallet feels different. Returns a short line.
const BIO_TEMPLATES: Record<string, string[]> = {
  dawn: [
    "woke up and locked in before the world did. attention is the only currency i respect.",
    "built the discipline while you scrolled. mornings are mine, focus is my religion.",
    "locked in at dawn, untouched by the noise. most people will never get this quiet.",
  ],
  day: [
    "attention-market casualty? not me. i locked in while the feed begged for my eyes.",
    "spent the day proving focus is a flex. the streak is real, the noise is fake.",
    "i don't scroll, i compound. every locked-in hour is a brick in the wall.",
  ],
  dusk: [
    "locked in past the sunset, discipline doesn't clock out. the night is for builders.",
    "while you chased notifications, i stacked focus. this is the only flex that lasts.",
    "dusk hits, most people quit. i lock in harder. attention is the new oil, i'm the refinery.",
  ],
  night: [
    "3am, still locked in. the world sleeps, the discipline compounds. i am the anomaly.",
    "night is when real focus lives. no notifications, just the streak and the silence.",
    "locked in while they dream. i'm building something they'll scroll past tomorrow.",
  ],
};
const bucketFromHour = (h: number) => (h < 6 ? "dawn" : h < 12 ? "day" : h < 18 ? "day" : h < 22 ? "dusk" : "night");
const bioFor = (addr?: string, totalSec = 0) => {
  const b = bucketFromHour(new Date().getHours());
  const list = BIO_TEMPLATES[b] || BIO_TEMPLATES.day;
  let h = 0;
  if (addr) for (let i = 2; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) >>> 0;
  const idx = (h + Math.floor(totalSec / 3600)) % list.length;
  return list[idx];
};

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
  const { disconnect } = useDisconnect();
  const { writeContract, writeContractAsync, isPending } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [authed, setAuthed] = useState(false);
  const signBusyRef = useRef(false); // guard auto sign-in loop on cancel (ref, no re-render)
  const [authError, setAuthError] = useState(false); // true when user cancelled sign-in
  const [prog, setProg] = useState<Progress | null>(null);
  const [badges, setBadges] = useState<number[]>([]);
  const [msg, setMsg] = useState("");
  const [toast, setToast] = useState<{ text: string; type: "ok" | "error" } | null>(null);
  const [tab, setTab] = useState<"focus" | "progress" | "pet" | "profile" | "settings">("focus");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0); // stopwatch seconds, counts up after Lock in
  const [sessionStart, setSessionStart] = useState(0); // wall-clock ms when session started (proof of presence)
  const [logging, setLogging] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null); // last onchain tx hash (for monadvision link)
  const [lockPopup, setLockPopup] = useState(false); // centered "locked in" popup (auto-dismiss)
  const [showShare, setShowShare] = useState(false);
  const [screen, setScreen] = useState<"splash" | "connect">("splash"); // E+D: splash first, then connect
  // Onchain avatar (portable across devices — stored in contract, not localStorage)
  const { data: onchainAvatar, refetch: refetchAvatar } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "avatar",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const saveCustomAvatar = async (dataUrl: string | null) => {
    if (!address) return;
    try {
      if (dataUrl) {
        await writeContractAsync({
          address: FOCUSPROOF_ADDRESS,
          abi: FOCUSPROOF_ABI,
          functionName: "setAvatar",
          args: [dataUrl],
          account: address as `0x${string}`,
          chain: monadTestnet,
        });
      } else {
        await writeContractAsync({
          address: FOCUSPROOF_ADDRESS,
          abi: FOCUSPROOF_ABI,
          functionName: "setAvatar",
          args: [""],
          account: address as `0x${string}`,
          chain: monadTestnet,
        });
      }
      await new Promise((r) => setTimeout(r, 2500));
      await refetchAvatar();
      setToast({ text: "PFP saved", type: "ok" });
    } catch {
      setToast({ text: "❌ Failed", type: "error" });
    }
  };

  const customAvatar = (onchainAvatar as string) || null;

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
    last28Days: number[]; // 28-day grid, index 27 = today, 7 cols x 4 rows
  } | null>(null);

  const publicClient = usePublicClient();

  const loadInsights = useCallback(async () => {
    if (!address || !publicClient) return;
    setInsights((prev) => ({ ...(prev as any), loading: true }));
    try {
      const logs = await publicClient.getContractEvents({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        eventName: "SessionLogged",
        args: { user: address },
        fromBlock: "earliest",
        toBlock: "latest",
      } as any) as any[];

      if (logs.length === 0) {
        setInsights({
          loading: false, totalSessions: 0, avgSessionMin: 0, longestSessionMin: 0,
          mostActivePeriod: "-", mostActiveDay: "-", avgGapHours: null, last7Days: [0, 0, 0, 0, 0, 0, 0], last28Days: new Array(28).fill(0),
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
      const last28Days = new Array(28).fill(0); // index 27 = today

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
        if (daysAgo >= 0 && daysAgo <= 27) last28Days[27 - daysAgo] += s.seconds;
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
        last28Days,
      });
    } catch (e) {
      setInsights({
        loading: false, totalSessions: 0, avgSessionMin: 0, longestSessionMin: 0,
        mostActivePeriod: "-", mostActiveDay: "-", avgGapHours: null, last7Days: [0, 0, 0, 0, 0, 0, 0], last28Days: new Array(28).fill(0),
      });
    }
  }, [address, publicClient]);

  useEffect(() => { loadInsights(); }, [loadInsights, prog]);

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
      await writeContractAsync({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        functionName: "setNickname",
        args: [nicknameInput.trim().slice(0, 20)],
        account: address as `0x${string}`,
        chain: monadTestnet,
      });
      // wait for onchain confirmation, then refetch so displayName updates
      await new Promise((r) => setTimeout(r, 2500));
      await refetchNickname();
      setNicknameInput("");
      setToast({ text: "Name saved", type: "ok" });
    } catch (e: any) {
      setToast({ text: "❌ Failed", type: "error" });
    } finally {
      setNicknameSaving(false);
    }
  };

  // Display name priority: .nad name > custom nickname > truncated address
  const displayName =
    nnsProfile?.primaryName ||
    (nicknameData as string) ||
    (address ? `@${address.slice(0,4)}...${address.slice(-2)}` : "");
  const isHandle = typeof displayName === "string" && displayName.startsWith("@");


  const { data: leaderboardAddrs } = useReadContract({
    address: FOCUSPROOF_ADDRESS,
    abi: FOCUSPROOF_ABI,
    functionName: "getLeaderboard",
    query: { refetchInterval: 10000 },
  });

  const [leaderboard, setLeaderboard] = useState<{ addr: string; streak: number; name: string }[]>([]);
  const [viewAddr, setViewAddr] = useState<string | null>(null); // clicked leaderboard user → modal
  const [viewData, setViewData] = useState<{ name: string; streak: number; xp: number; level: number; sessions: number; total: number } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (!viewAddr || !publicClient) return;
    (async () => {
      setViewLoading(true);
      try {
        const f = await publicClient.readContract({ address: FOCUSPROOF_ADDRESS, abi: FOCUSPROOF_ABI, functionName: "getProgress", args: [viewAddr] } as any) as any[];
        const nick = await publicClient.readContract({ address: FOCUSPROOF_ADDRESS, abi: FOCUSPROOF_ABI, functionName: "nickname", args: [viewAddr] } as any) as string;
        setViewData({
          name: (nick && nick.length > 0 ? nick : `${viewAddr.slice(0, 4)}…${viewAddr.slice(-4)}`),
          streak: Number(f[2] ?? 0), xp: Number(f[3] ?? 0), level: Number(f[4] ?? 0),
          sessions: Number(f[5] ?? 0), total: Number(f[0] ?? 0),
        });
      } catch { setViewData(null); }
      setViewLoading(false);
    })();
  }, [viewAddr, publicClient]);

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
          // priority 1: our own onchain nickname (single call per addr)
          names = await Promise.all(addrs.map(async (a) => {
            try {
              const n = await publicClient.readContract({ address: FOCUSPROOF_ADDRESS, abi: FOCUSPROOF_ABI, functionName: "nickname", args: [a] } as any) as string;
              return (n && n.length > 0) ? n : null;
            } catch { return null; }
          }));
        } catch {}
        // priority 2: NNS (if nickname empty)
        if (names.some((n) => !n)) {
          try {
            const nnsAddress = "0x3019BF1dfB84E5b46Ca9D0eEC37dE08a59A41308" as `0x${string}`;
            const nnsAbi = [{ type: "function", name: "getProfilesForAddresses", stateMutability: "view", inputs: [{ name: "addrs", type: "address[]" }], outputs: [{ type: "tuple[]", components: [{ name: "addr", type: "address" }, { name: "primaryName", type: "string" }, { name: "avatar", type: "string" }] }] }] as const;
            const profiles = await publicClient.readContract({ address: nnsAddress, abi: nnsAbi, functionName: "getProfilesForAddresses", args: [addrs] } as any) as any[];
            names = names.map((n, i) => n || profiles[i]?.primaryName || null);
          } catch {}
        }

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

  // auto sign-in: pas connect, langsung trigger sign (gak ada card manual)
  useEffect(() => {
    if (isConnected && !authed && address && !signBusyRef.current) {
      signBusyRef.current = true;
      setAuthError(false);
      (async () => {
        try {
          await (signMessageAsync as any)({ account: address as `0x${string}`, message: `FokusLe login\nWallet: ${address}\nSign to prove ownership.` });
          setToast(null);
          setAuthed(true);
        } catch {
          setAuthError(true);
          setToast({ text: "user cancelled sign in request", type: "error" });
        } finally {
          signBusyRef.current = false;
        }
      })();
    }
  }, [isConnected, authed, address, signMessageAsync]);

  const signIn = useCallback(async () => {
    if (!address) return;
    try {
      await (signMessageAsync as any)({ account: address as `0x${string}`, message: `FokusLe login\nWallet: ${address}\nSign to prove ownership.` });
      setAuthed(true);
    } catch {
      setToast({ text: "❌ Sign cancelled.", type: "error" });
    }
  }, [address, signMessageAsync]);

  // stopwatch — counts UP from 0 once a session is running
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const startSession = async () => {
    // NO onchain tx — just start the local timer. Data is only written on finish/log.
    setStarted(true);
    setRunning(true);
    setElapsed(0);
    setSessionStart(Date.now());
    setLockPopup(true);
    setTimeout(() => setLockPopup(false), 1600);
  };

  // Leaving the app (tab switch / minimize / close) while a session is running
  // = automatic failure. This is the core "Proof of Discipline" guarantee:
  // you cannot walk away and still claim the focus.
  const failSession = useCallback(() => {
    setStarted(false);
    setRunning(false);
    setElapsed(0);
    setToast({ text: "❌ Session failed — left tab", type: "error" });
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden && running) failSession();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running, failSession]);

  const logSession = async () => {
    if (!address) return;
    // Wall-clock elapsed (real proof of presence, not the local countdown
    // which can be tampered). This is what gets logged onchain.
    const elapsedSec = Math.max(0, Math.floor((Date.now() - sessionStart) / 1000));
    const focused = BigInt(Math.max(elapsedSec, elapsed));
    if (focused <= 0n) { setToast({ text: "Timer not started", type: "error" }); return; }
    // Replay-proof nonce: must equal the next unused session index.
    const nonce = (prog?.sessionCount ?? 0n) + 1n;
    setLogging(true);
    try {
      // Wallet signs (address, secondsFocused, nonce) — attests THIS wallet focused
      // THIS long, and the monotonic nonce prevents replay inflation.
      const hash = keccak256(encodePacked(["address", "uint256", "uint256"], [address as `0x${string}`, focused, nonce]));
      const sig = await (signMessageAsync as any)({ account: address as `0x${string}`, message: { raw: hash as `0x${string}` } });
      const tx = await writeContractAsync({
        address: FOCUSPROOF_ADDRESS,
        abi: FOCUSPROOF_ABI,
        functionName: "logFocus",
        args: [focused, nonce, sig],
        account: address,
        chain: monadTestnet,
      } as any);
      setLastTx(typeof tx === "string" ? tx : (tx as any)?.hash ?? null);
      // wait for receipt + refetch onchain progress
      await refetchProg();
      await refetchBadge();
      setRunning(false);
      setStarted(false);
      setElapsed(0);
      setShowShare(true); // show share modal AFTER successful log
      setToast({ text: "Success", type: "ok" });
    } catch (e: any) {
      setToast({ text: "❌ Failed", type: "error" });
    } finally {
      setLogging(false);
    }
  };

  const shareText = () => {
    if (!prog) return "";
    return `LOCKED IN

Today
${fmt(prog.weeklySeconds < prog.totalSeconds ? prog.weeklySeconds : prog.totalSeconds)}

Weekly
${fmt(prog.weeklySeconds)}

Current Streak
${prog.streak} Days

Focus Score
${fmtPct(prog.weeklySeconds, 7n * 3600n * 8n)}%

Wallet
${address?.slice(0, 6)}…${address?.slice(-4)}

Verify onchain: https://testnet.monadvision.com/address/${FOCUSPROOF_ADDRESS}`;
  };
  const share = (platform: string) => {
    const text = shareText();
    if (platform === "dc") {
      navigator.clipboard.writeText(text);
      downloadCard();
      setToast({ text: "Card copied", type: "ok" });
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
    setToast({ text: "Card downloaded", type: "ok" });
  };

  const cardToday = fmt(prog?.weeklySeconds ?? 0n);
  const T = themes[theme];
  // theme-aware ghost button colors (fix light-mode white-on-white)
  const GHOST = theme === "dark"
    ? { bg: "rgba(255,255,255,0.12)", border: "rgba(255,255,255,0.35)", text: "#fff" }
    : { bg: "rgba(110,84,255,0.08)", border: "rgba(110,84,255,0.35)", text: "#3a2f66" };
  const sessionPct = started ? Math.min(100, Math.round((elapsed / 3600) * 100)) : 0;

  const S = {
    device: { width: 390, minHeight: 780, background: theme === "dark" ? "rgba(14,9,28,0.72)" : "rgba(247,245,255,0.85)", backdropFilter: "blur(14px)", color: T.text, borderRadius: 28, overflow: "hidden", margin: "20px auto", fontFamily: "var(--font-inter), -apple-system, sans-serif", position: "relative" as const, border: `1px solid ${T.border}`, boxShadow: "0 20px 60px rgba(0,0,0,0.45)" },
    screen: { padding: "16px 20px 90px", minHeight: 700 },
    hero: { background: "linear-gradient(160deg, rgba(110,84,255,0.20) 0%, rgba(42,31,102,0.10) 50%, transparent 100%)", border: "1px solid rgba(110,84,255,0.35)", borderRadius: 24, padding: "22px 20px 26px", marginBottom: 16, boxShadow: "0 8px 30px rgba(110,84,255,0.10)" },
    card: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, marginBottom: 12, backdropFilter: "blur(6px)" },
    sectionTitle: { display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" } as const,
    sectionH3: { fontSize: 13, fontWeight: 700, margin: 0, fontFamily: "var(--font-grotesk), sans-serif", letterSpacing: 0.3 } as const,
    chip: (active: boolean) => ({ flex: 1, textAlign: "center" as const, background: active ? "#fff" : GHOST.bg, color: active ? T.accent : GHOST.text, fontSize: 12, fontWeight: 600, padding: "8px 0 6px", borderRadius: 14, cursor: "pointer", border: "none" }),
    tabbar: { position: "absolute" as const, bottom: 0, left: 0, right: 0, height: 64, background: T.card, borderTop: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-around", backdropFilter: "blur(10px)" },
    tab: (active: boolean) => ({ color: active ? "#fff" : T.muted, background: active ? "linear-gradient(150deg,#8b7bff,#6E54FF)" : "transparent", fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 10, cursor: "pointer", border: "none", fontFamily: "var(--font-inter), sans-serif", boxShadow: active ? "0 4px 14px rgba(110,84,255,0.35)" : "none" }),
    feedItem: { display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` },
    streakTag: { marginLeft: "auto", background: T.card2, color: T.accent, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 999, fontFamily: "var(--font-mono), monospace" },
  };

  return (
    <div style={{ background: theme === "dark" ? "#0a0712" : "#eee9ff", minHeight: "100vh", padding: "20px 0" }}>
      {screen === "splash" ? (
        // SPLASH (E+D): philosophical quote + visual orb + tap to begin
        <div onClick={() => setScreen("connect")} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", cursor: "pointer", textAlign: "center" }}>
          <div style={{ position: "relative", width: 180, height: 180, marginBottom: 40 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "999px", background: "radial-gradient(circle, rgba(139,123,255,0.45) 0%, rgba(110,84,255,0.12) 55%, transparent 72%)", filter: "blur(28px)", animation: "fkfloat 4s ease-in-out infinite" }} />
            <div style={{ position: "absolute", inset: 28, borderRadius: "999px", border: "2px solid transparent", background: "conic-gradient(from 0deg, rgba(255,255,255,0.05), rgba(110,84,255,0.7), rgba(255,255,255,0.05)) border-box", WebkitMask: "linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude", animation: "fkspin 8s linear infinite", boxShadow: "0 0 30px rgba(110,84,255,0.3)" }} />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: "#fff", fontFamily: "var(--font-grotesk), sans-serif", lineHeight: 1.5, maxWidth: 300, letterSpacing: 0.2 }}>
            Focus is the only flex that can't be faked. So we put it onchain.
          </div>
          <div style={{ marginTop: 46, fontSize: 11, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 2 }}>
            Tap to begin
          </div>
          <style>{`@keyframes fkfloat { 0%,100% { transform: translateY(0); opacity: 0.85; } 50% { transform: translateY(-8px); opacity: 1; } } @keyframes fkspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
      <div style={S.device as any}>
        <div style={S.screen}>
          {!isConnected ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 640, textAlign: "center", padding: "0 16px" }}>
              <img src="/logo.png" width={76} height={76} style={{ width: 76, height: 76, borderRadius: 22, objectFit: "cover", boxShadow: "0 12px 30px rgba(110,84,255,0.4)", marginBottom: 18 }} alt="FokusLe" />
              <h2 style={{ fontSize: 24, margin: "0 0 6px", fontFamily: "var(--font-grotesk), sans-serif", color: T.text }}>FokusLe</h2>
              <p style={{ color: T.muted, fontSize: 14, margin: "0 0 30px", lineHeight: 1.5, maxWidth: 260 }}>Are you ready to lock in?</p>
              <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
                <ConnectButton />
              </div>
            </div>
          ) : !authed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 640, textAlign: "center", padding: "0 16px" }}>
              {authError ? (
                <>
                  <p style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>Sign in cancelled.</p>
                  <button onClick={() => { setAuthError(false); setAuthed(false); }} style={{ background: T.accent, color: "#fff", border: "none", padding: "12px 22px", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Try again</button>
                </>
              ) : (
                <p style={{ color: T.muted, fontSize: 13 }}>Approve the sign request in your wallet to continue…</p>
              )}
            </div>
          ) : (
            <>
              {toast && (
                <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 120, background: toast.type === "error" ? "rgba(60,20,30,0.95)" : "rgba(20,12,40,0.95)", border: `1px solid ${toast.type === "error" ? "rgba(255,80,110,0.5)" : "rgba(110,84,255,0.5)"}`, color: "#fff", padding: "10px 16px", borderRadius: 12, fontSize: 12, maxWidth: 320, textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", animation: "fktoast 0.25s ease-out" }}>
                  {toast.text}
                </div>
              )}
              {toast && <style>{`@keyframes fktoast { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>}
              {(() => { if (toast) setTimeout(() => setToast(null), 4000); return null; })()}

              {/* FOCUS TAB */}
              {tab === "focus" && (
                <>
                  <div style={S.hero}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <img src="/logo.png" width={22} height={22} style={{ width: 22, height: 22, borderRadius: 7, objectFit: "cover" }} alt="FokusLe" />
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: "var(--font-grotesk), sans-serif" }}>FokusLe</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: GHOST.bg, borderRadius: 999, padding: "5px 10px 5px 6px" }}>
                        <div style={{ width: 7, height: 7, borderRadius: 999, background: "#4ADE80" }} />
                        <div style={{ fontSize: isHandle ? 11 : 13, fontWeight: 600, color: GHOST.text, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 4px", position: "relative" }}>
                      <svg width="200" height="200" viewBox="0 0 200 200">
                        <defs>
                          <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b7bff" />
                            <stop offset="100%" stopColor="#6E54FF" />
                          </linearGradient>
                        </defs>
                        <circle cx="100" cy="100" r="86" stroke="rgba(255,255,255,0.14)" strokeWidth="14" fill="none" />
                        <circle cx="100" cy="100" r="86" stroke="#ffffff" strokeWidth="14" fill="none"
                          strokeDasharray={540} strokeDashoffset={540 - (540 * Math.min(sessionPct, 100)) / 100}
                          strokeLinecap="round" transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1s linear", filter: "drop-shadow(0 0 8px rgba(110,84,255,0.45))" }} />
                      </svg>
                      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                        <div style={{ fontSize: 30, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono), monospace" }}>{sessionPct}%</div>
                      </div>
                    </div>
                    {/* timer number BELOW the ring (separate, not overlapping) */}
                    <div style={{ textAlign: "center", marginTop: 2 }}>
                      <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", fontFamily: "var(--font-mono), monospace", letterSpacing: 1 }}>
                        {running || started ? fmtClock(elapsed) : "00:00"}
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>
                        {running ? "Focusing…" : started ? "Paused" : "Ready"}
                      </div>
                    </div>

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
                    <div style={{ textAlign: "center", fontSize: 11, color: T.muted, marginTop: 10, fontFamily: "var(--font-grotesk), sans-serif", lineHeight: 1.5 }}>lock in. stay. that's the discipline.</div>
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
                    <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{fmtHourPct(Number(prog.totalSeconds))}%</div><div style={{ fontSize: 10, color: T.muted }}>Total ({fmt(prog.totalSeconds)})</div></div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{String(prog.sessionCount)}</div><div style={{ fontSize: 10, color: T.muted }}>Sessions</div></div>
                    <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{insights && insights.avgSessionMin ? `${fmtHourPct(insights.avgSessionMin * 60)}%` : "-"}</div><div style={{ fontSize: 10, color: T.muted }}>Avg / session</div></div>
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Last 28 days</h3></div>
                  <div style={S.card}>
                    {insights?.last28Days ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                        {insights.last28Days.map((sec, i) => {
                          // intensity: 1h = full level; 5 buckets
                          const lvl = sec === 0 ? 0 : Math.min(4, 1 + Math.floor(Number(sec) / 900));
                          const colors = ["#1c1436", "rgba(110,84,255,0.28)", "rgba(110,84,255,0.5)", "rgba(110,84,255,0.75)", "#8b7bff"];
                          return (
                            <div key={i} title={`${Math.floor(Number(sec) / 3600 * 10) / 10}h focused`} style={{ aspectRatio: "1 / 1", borderRadius: 4, background: colors[lvl], border: "1px solid rgba(110,84,255,0.15)" }} />
                          );
                        })}
                      </div>
                    ) : <div style={{ color: T.muted, fontSize: 12 }}>Loading…</div>}
                  </div>

                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Leaderboard</h3></div>
                  <div style={S.card}>
                    {leaderboard.length === 0 ? (
                      <div style={{ color: T.muted, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Nobody has logged a session yet — be first.</div>
                    ) : leaderboard.slice(0, 10).map((row, i) => {
                      const isMe = row.addr.toLowerCase() === address?.toLowerCase();
                      const av = isMe && customAvatar ? customAvatar : `https://api.dicebear.com/7.x/shapes/svg?seed=${row.addr}`;
                      return (
                      <div key={row.addr} style={{ ...S.feedItem, cursor: "pointer" }} onClick={() => setViewAddr(row.addr)}>
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
                    <h2 style={{ fontSize: 17, margin: "0 0 8px", fontFamily: "var(--font-grotesk), sans-serif" }}>Focus Pet</h2>
                    <p style={{ color: T.muted, fontSize: 13, lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>The companion that grows and reacts to your streak is still coming. Gacha pulls are live now, ahead of it.</p>
                  </div>

                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <b style={{ fontSize: 13 }}>Monanimal Gacha</b>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: T.muted, fontFamily: "var(--font-mono), monospace" }}>{prog ? String(prog.xp) : 0} XP</span>
                    </div>
                    <p style={{ color: T.muted, fontSize: 12, lineHeight: 1.6, margin: "0 0 14px" }}>
                      A companion that grows as you focus. Pull one with XP.
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
                  <div style={{ ...S.card, textAlign: "center", background: "linear-gradient(160deg, rgba(110,84,255,0.12) 0%, rgba(42,31,102,0.06) 60%, transparent 100%)", border: "1px solid rgba(110,84,255,0.30)", padding: 20 }}>
                    <img src={customAvatar || nnsProfile?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${address}`} style={{ width: 68, height: 68, borderRadius: 999, margin: "0 auto 12px", display: "block", border: "2px solid rgba(110,84,255,0.5)", boxShadow: "0 6px 18px rgba(110,84,255,0.25)" }} />
                    <div style={{ fontWeight: 700, fontSize: isHandle ? 14 : 17, color: T.text, fontFamily: "var(--font-grotesk), sans-serif" }}>{displayName}</div>
                    <div style={{ color: T.muted, fontSize: 11.5, marginTop: 6, lineHeight: 1.5, padding: "0 6px", fontStyle: "italic" }}>{bioFor(address, prog ? Number(prog.totalSeconds) : 0)}</div>
                  </div>

                  {prog && (
                    <div style={S.card}>
                      <div style={{ display: "flex", gap: 10 }}>
                        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{fmtHourPct(Number(prog.totalSeconds))}%</div><div style={{ fontSize: 10, color: T.muted }}>Total ({fmt(prog.totalSeconds)})</div></div>
                        <div style={{ flex: 1, textAlign: "center", borderLeft: `1px solid ${T.border}` }}><div style={{ fontSize: 16, fontWeight: 700, fontFamily: "var(--font-mono), monospace" }}>{String(prog.sessionCount)}</div><div style={{ fontSize: 10, color: T.muted }}>Sessions</div></div>
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
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", fontSize: 13 }}><span style={{ color: T.muted }}>Longest session</span><span style={{ fontWeight: 600, fontFamily: "var(--font-mono), monospace" }}>{fmtHourPct(insights.longestSessionMin * 60)}%</span></div>
                      </>
                    )}
                  </div>

                  {prog && (
                    <>
                      <div style={S.sectionTitle}><h3 style={S.sectionH3}>Lock-In Card</h3></div>
                      <div style={{ ...S.card, backgroundImage: T.grad, border: "none" }}>
                        <div style={{ color: T.text, fontWeight: 700, letterSpacing: 2, fontSize: 12 }}>LOCKED IN</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
                          <div><div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "var(--font-mono), monospace" }}>{cardToday}</div><div style={{ fontSize: 11, color: T.muted }}>Today</div></div>
                          <div><div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "var(--font-mono), monospace" }}>{prog ? `${prog.streak}d` : "0"} Days</div><div style={{ fontSize: 11, color: T.muted }}>Streak</div></div>
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
                  {/* ACCOUNT — top */}
                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Account</h3></div>
                  <div style={S.card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
                      <img src={customAvatar || nnsProfile?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${address}`} style={{ width: 52, height: 52, borderRadius: 999, border: "2px solid rgba(110,84,255,0.5)", objectFit: "cover" }} />
                      <label style={{ background: GHOST.bg, border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {customAvatar ? "Change" : "Upload"}
                        <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            const img = new Image();
                            img.onload = () => {
                              const size = 128;
                              const canvas = document.createElement("canvas");
                              canvas.width = size; canvas.height = size;
                              const ctx = canvas.getContext("2d")!;
                              const min = Math.min(img.width, img.height);
                              const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
                              ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
                              const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                              saveCustomAvatar(dataUrl);
                            };
                            img.src = reader.result as string;
                          };
                          reader.readAsDataURL(f);
                        }} />
                      </label>
                      {customAvatar && (
                        <button onClick={() => saveCustomAvatar(null)} style={{ background: "transparent", border: `1px solid ${GHOST.border}`, color: GHOST.text, padding: "8px 12px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>Reset</button>
                      )}
                    </div>
                    <div style={{ padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Display name</div>
                      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, lineHeight: 1.5 }}>{(nicknameData as string) ? `Current: ${nicknameData as string}` : "No .nad name — set a custom nickname (stored onchain)."}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} placeholder="Nickname (max 20 chars)" maxLength={20}
                          style={{ flex: 1, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px", color: T.text, fontSize: 13, outline: "none" }} />
                        <button onClick={saveNickname} disabled={nicknameSaving} style={{ background: T.accent, color: "#fff", border: "none", padding: "0 16px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                          {nicknameSaving ? "..." : "Save"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 0", fontSize: 13 }}><span style={{ color: "#ff9b9b" }}>Sign out</span><span style={{ color: "#ff9b9b", cursor: "pointer" }} onClick={() => setAuthed(false)}>→</span></div>
                  </div>

                  {/* SETTINGS / GENERAL — middle */}
                  <div style={S.sectionTitle}><h3 style={S.sectionH3}>Settings</h3></div>
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

                  {/* ABOUT — bottom */}
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

        {viewAddr && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110 }} onClick={() => setViewAddr(null)}>
            <div style={{ width: 280, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 20, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2, fontFamily: "var(--font-grotesk), sans-serif" }}>{viewData?.name || "…"}</div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 14, wordBreak: "break-all", padding: "0 10px" }}>{viewAddr}</div>
              {viewLoading ? <div style={{ color: T.muted, fontSize: 12 }}>Loading…</div> : viewData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: T.muted }}>Streak</span><b>{viewData.streak}d</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: T.muted }}>Total locked in</span><b style={{ fontFamily: "var(--font-mono), monospace" }}>{fmt(BigInt(viewData.total))}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: T.muted }}>Sessions</span><b>{viewData.sessions}</b></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: T.muted }}>XP / Level</span><b style={{ fontFamily: "var(--font-mono), monospace" }}>{viewData.xp} / {viewData.level}</b></div>
                </div>
              ) : <div style={{ color: T.muted, fontSize: 12 }}>No data.</div>}
              <button onClick={() => setViewAddr(null)} style={{ width: "100%", marginTop: 16, background: T.accent, color: "#fff", border: "none", padding: 11, borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Close</button>
            </div>
          </div>
        )}

        {showShare && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <div style={{ width: 260, background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, fontFamily: "var(--font-grotesk), sans-serif" }}>Session locked in</div>
              <p style={{ color: T.muted, fontSize: 12, margin: "0 0 16px", lineHeight: 1.5 }}>Your flex card is ready. Share it or keep it.</p>
              <button onClick={() => { share("x"); setShowShare(false); }} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", padding: 12, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", marginBottom: 8 }}>
                Share to X
              </button>
              <button onClick={() => setShowShare(false)} style={{ width: "100%", background: "transparent", color: T.muted, border: "none", padding: 10, fontSize: 13, cursor: "pointer" }}>
                Keep it
              </button>
            </div>
          </div>
        )}

        {lockPopup && (
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, pointerEvents: "none" }}>
            <div style={{ background: "rgba(20,12,40,0.92)", border: `1px solid rgba(110,84,255,0.5)`, borderRadius: 12, padding: "10px 18px", textAlign: "center", minWidth: 200, maxWidth: 260, display: "flex", alignItems: "center", gap: 10, boxShadow: "0 12px 40px rgba(110,84,255,0.25)", backdropFilter: "blur(8px)", animation: "fkpop 0.25s ease-out" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(150deg,#8b7bff,#6E54FF)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(110,84,255,0.4)" }}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: "var(--font-grotesk), sans-serif", letterSpacing: 0.3 }}>Locked in</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>Focus now.</div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      <p style={{ textAlign: "center", color: "#555c6e", fontSize: 11, marginTop: -4 }}>
        Fokusle
      </p>
    </div>
  );
}
