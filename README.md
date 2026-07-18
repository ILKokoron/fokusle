# 🔒 Fokusle — Proof of Focus, Proof of Discipline

**Spark Hackathon (BuildAnything) submission.**

> "Build something practical that solves a real problem YOU have."

## The problem
In crypto everyone flexes PnL. But the thing that actually builds a life — **consistency** — is invisible. I'm a dopamine addict; I lose focus daily. Existing focus apps nag but have zero consequence. And most "onchain" trackers are just databases with gas — you can log any number.

## The solution
Fokusle makes focus **verifiable**. You commit to a session by signing a message (wallet = identity). The signature is checked onchain before any session counts. No commit → no log. No fake hours.

Then you build onchain proof: total hours, daily streak, weekly focus, XP, level — plus **soulbound badges** you can't buy, only earn.

> "Everyone flexes their PnL. We help people flex something harder: consistency."

## Stack (per hackathon instructions)
- **Smart contract**: Solidity, deployed via **Foundry** on **Monad Testnet**
- **Frontend**: Next.js + **viem** + **wagmi** + RainbowKit
- **Auth**: Sign message (no gas) — wallet = identity
- **Proof**: commit-reveal with ECDSA signature verification onchain
- **Monad**: parallel `getStreaks(address[])` leaderboard read
- **Chain**: Monad Testnet (chainId 10143)

## Contract
- Address: `0x08F71A7564336D176563ED971704EEAd37229D6b`
- Explorer: https://testnet.monadexplorer.com/address/0x08F71A7564336D176563ED971704EEAd37229D6b
- Network: Monad Testnet
- App: https://frontend-wheat-psi-22.vercel.app

## How "Proof" works (anti-fake)
1. User picks duration, clicks **Lock In**
2. Frontend signs `keccak256(addr, duration, timestamp)` with wallet
3. `commit(duration, sig)` — contract recovers signer, must == caller
4. Timer runs; on complete, `logFocus(seconds)` — only works if committed & within window
5. State updates onchain. Fake logs impossible without the wallet's signature.

## Features
- ✅ Wallet login (sign message, no account)
- ✅ Commit-reveal verified focus sessions
- ✅ Onchain progress: hours, streak, weekly, XP, level
- ✅ Soulbound achievement badges (First Hour → Locked In)
- ✅ Parallel leaderboard (`getStreaks` multicall)
- ✅ Lock-In Card with 1-click share to X / Telegram / Discord
- 🚫 No staking. No pool. No token. (can be added later)

## Why this wins
- **Real proof**, not a database — signature-gated sessions
- **Monad-native**: parallel streak reads showcase the parallel EVM
- **Sells identity, not money** — counter-narrative to PnL-flexing
- Solves a *personal* problem (exact hackathon prompt)

---
Built by ASA MITAKA · Solves a problem I actually have.
