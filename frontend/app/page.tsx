"use client";

import { useEffect, useState, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useSignMessage } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { FOKUSLE_ADDRESS, FOKUSLE_ABI, BADGE_META } from "../lib/abi";
import { renderFokusCard, type CardBadge } from "../lib/card";
import styles from "./page.module.css";

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
const mmss = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;

export default function Home() {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const { signMessageAsync } = useSignMessage();

  const [authed, setAuthed] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [badges, setBadges] = useState<number[]>([]);
  const [badgesState, setBadgesState] = useState<bigint>(0n);
  const [nickname, setNickname] = useState("");
  const [msg, setMsg] = useState("");

  const [running, setRunning] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [dur, setDur] = useState(25 * 60);
  const [left, setLeft] = useState(25 * 60);
  const [logging, setLogging] = useState(false);

  const { data: progData, refetch: refetchProg } = useReadContract({
    address: FOKUSLE_ADDRESS,
    abi: FOKUSLE_ABI,
    functionName: "getProgress",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { data: badgeData } = useReadContract({
    address: FOKUSLE_ADDRESS,
    abi: FOKUSLE_ABI,
    functionName: "getBadges",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });
  const { data: nickData } = useReadContract({
    address: FOKUSLE_ADDRESS,
    abi: FOKUSLE_ABI,
    functionName: "nickname",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 4000 },
  });

  useEffect(() => {
    if (progData) {
      const p = progData as unknown as bigint[];
      setProg({
        totalSeconds: p[0],
        weeklySeconds: p[1],
        streak: p[2],
        xp: p[3],
        level: p[4],
        sessionCount: p[5],
      });
    }
    if (badgeData) {
      const ids = badgeData as unknown as bigint[];
      setBadges(ids.map((id) => Number(id)));
      let bits = 0n;
      ids.forEach((id) => {
        const i = Number(id) - 1;
        if (i >= 0 && i < 5) bits |= 1n << BigInt(i);
      });
      setBadgesState(bits);
    }
    if (nickData) setNickname((nickData as string) || "");
  }, [progData, badgeData, nickData]);

  const signIn = useCallback(async () => {
    if (!address) return;
    try {
      await signMessageAsync({
        message: `Fokusle login\nWallet: ${address}\nSign to prove ownership.`,
      } as any);
      setAuthed(true);
      setMsg("Signed in. Wallet = your identity.");
    } catch {
      setMsg("Sign cancelled.");
    }
  }, [address, signMessageAsync]);

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
    if (!address) return;
    setMsg("Signing commit...");
    try {
      const h = keccak256(
        encodePacked(["address", "uint256"], [address as `0x${string}`, BigInt(dur)])
      );
      const sig = await signMessageAsync({ message: { raw: h } } as any);
      setMsg("Committing onchain...");
      writeContract({
        address: FOKUSLE_ADDRESS,
        abi: FOKUSLE_ABI as any,
        functionName: "commit",
        args: [BigInt(dur), sig as `0x${string}`],
      } as any);
      setCommitted(true);
      setLeft(dur);
      setRunning(true);
      setMsg("Locked in. Focus now.");
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message || "commit failed");
    }
  };

  const logSession = async () => {
    if (!address) return;
    const focused = BigInt(dur - left);
    if (!committed) {
      setMsg("Commit first.");
      return;
    }
    if (focused <= 0n) {
      setMsg("Timer not finished.");
      return;
    }
    setLogging(true);
    setMsg("");
    try {
      writeContract({
        address: FOKUSLE_ADDRESS,
        abi: FOKUSLE_ABI as any,
        functionName: "logFocus",
        args: [focused],
      } as any);
      setMsg(`Logging ${fmt(focused)} onchain...`);
      setCommitted(false);
    } catch (e: any) {
      setMsg(e?.shortMessage || e?.message);
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
${address?.slice(0, 6)}…${address?.slice(-4)}`;
  };
  const share = (platform: string) => {
    const text = encodeURIComponent(shareText());
    if (platform === "dc") {
      navigator.clipboard.writeText(shareText());
      setMsg("Lock-In card copied — paste to Discord.");
      return;
    }
    const urls: Record<string, string> = {
      x: `https://twitter.com/intent/tweet?text=${text}`,
      tg: `https://t.me/share/url?url=https://fokusle.xyz&text=${text}`,
    };
    window.open(urls[platform], "_blank");
  };

  const downloadCard = () => {
    if (!prog) return;
    const bgs: CardBadge[] = Object.values(BADGE_META).map((b, i) => ({
      name: b.name,
      got: (badgesState >> BigInt(i)) & 1n ? true : false,
    }));
    const url = renderFokusCard({
      handle: nickname || (address?.slice(0, 6) ?? "anon"),
      wallet: address ?? "",
      weeklySeconds: prog.weeklySeconds,
      totalSeconds: prog.totalSeconds,
      streak: prog.streak,
      xp: prog.xp,
      level: prog.level,
      badges: bgs,
    });
    const a = document.createElement("a");
    a.href = url;
    a.download = "fokusle-lockedin.png";
    a.click();
    setMsg("Card PNG downloaded.");
  };

  const cardToday = fmt(prog?.weeklySeconds ?? 0n);

  return (
    <main className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.brand}>Fokusle</h1>
        <ConnectButton />
      </header>
      <p className={styles.tagline}>
        Proof of Focus. Proof of Discipline. Flex consistency, not PnL.
      </p>

      {msg && <div className={styles.notice}>{msg}</div>}

      {!isConnected ? (
        <div className={styles.connectPrompt}>Connect your wallet to begin.</div>
      ) : (
        <>
          {!authed ? (
            <section className={styles.card}>
              <p style={{ margin: 0 }}>
                Wallet: <code className={styles.walletCode}>{address?.slice(0, 10)}…</code>
              </p>
              <button className={styles.btn} style={{ marginTop: 12 }} onClick={signIn}>
                Sign to login (no gas)
              </button>
            </section>
          ) : (
            <>
              <section className={styles.card}>
                <h2 className={styles.sectionTitle}>Focus Session</h2>
                <div className={styles.durRow}>
                  {[25, 45, 50, 90].map((m) => (
                    <button
                      key={m}
                      className={dur === m * 60 ? styles.btn : styles.btnGhost}
                      onClick={() => setDur(m * 60)}
                      disabled={running || committed}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
                <div className={`${styles.timer} ${running ? styles.timerActive : ""}`}>
                  {mmss(left)}
                </div>
                <div className={styles.actions}>
                  {!running && !committed ? (
                    <button className={styles.btn} onClick={startSession}>
                      Lock In &amp; Start
                    </button>
                  ) : running ? (
                    <button className={styles.btnDanger} onClick={() => setRunning(false)}>
                      Pause
                    </button>
                  ) : (
                    <button
                      className={styles.btn}
                      style={{ marginLeft: 10 }}
                      onClick={logSession}
                      disabled={isPending || left !== 0}
                    >
                      Log Session Onchain
                    </button>
                  )}
                </div>
                {committed && left === 0 && !logging && (
                  <p className={styles.done}>Session done — log it onchain!</p>
                )}
              </section>

              {prog && (
                <section className={styles.card} style={{ marginTop: 20 }}>
                  <h2 className={styles.sectionTitle}>Progress</h2>
                  <div className={styles.statGrid}>
                    <Stat label="Total Focus" value={fmt(prog.totalSeconds)} accent="#7c5cff" />
                    <Stat label="Daily Streak" value={`${prog.streak}d`} />
                    <Stat label="Weekly" value={fmt(prog.weeklySeconds)} />
                    <Stat label="XP" value={String(prog.xp)} />
                    <Stat label="Level" value={String(prog.level)} />
                    <Stat label="Sessions" value={String(prog.sessionCount)} />
                  </div>
                  <h3 className={styles.subhead}>Achievements</h3>
                  <div className={styles.badgeRow}>
                    {[1, 2, 3, 4, 5].map((id) => {
                      const owned = badges.includes(id);
                      const m = BADGE_META[id];
                      return (
                        <div
                          key={id}
                          className={`${styles.badge} ${owned ? "" : styles.badgeLocked}`}
                        >
                          {m.icon} {m.name}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {prog && (
                <section className={styles.lockCard}>
                  <h2 className={styles.sectionTitle}>Lock-In Card</h2>
                  <div className={styles.lockInner}>
                    <div className={styles.lockTitle}>LOCKED IN</div>
                    <div className={styles.lockGrid}>
                      <CardStat label="Today" value={cardToday} />
                      <CardStat label="Weekly" value={fmt(prog.weeklySeconds)} />
                      <CardStat label="Current Streak" value={`${prog.streak} Days`} />
                      <CardStat
                        label="Focus Score"
                        value={`${fmtPct(prog.weeklySeconds, 7n * 3600n * 8n)}%`}
                      />
                    </div>
                    <div className={styles.lockWallet}>
                      Wallet: {address?.slice(0, 6)}…{address?.slice(-4)}
                    </div>
                  </div>
                  <div className={styles.shareRow}>
                    <button className={styles.btn} onClick={downloadCard}>
                      Download Card PNG
                    </button>
                    <button className={styles.btnGhost} onClick={() => share("x")}>
                      Share X
                    </button>
                    <button className={styles.btnGhost} onClick={() => share("tg")}>
                      Telegram
                    </button>
                    <button className={styles.btnGhost} onClick={() => share("dc")}>
                      Discord
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <footer className={styles.footer}>
        Fokusle · Monad Testnet · 0x08F71A7564336D176563ED971704EEAd37229D6b · Wallet = identity.
        Commit-reveal proof. No staking.
      </footer>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={styles.statBox}>
      <div className={styles.statValue} style={{ color: accent || "#e6e6e6" }}>
        {value}
      </div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.lockStat}>
      <div className={styles.lockStatValue}>{value}</div>
      <div className={styles.lockStatLabel}>{label}</div>
    </div>
  );
}
