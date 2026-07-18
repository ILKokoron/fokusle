# 🔒 Fokusle — Pitch Deck

**Spark Hackathon · BuildAnything**
"Build anything onchain that solves a personal problem"

---

## Slide 1 — Title

# 🔒 Fokusle
### Proof of Focus. Proof of Discipline.

A productivity app for Web3 users.
Wallet = identity. Consistency = onchain proof.

**Built by ASA MITAKA**

---

## Slide 2 — Problem

In crypto, everyone flexes **PnL**.

But the thing that actually builds a life — **consistency** — is invisible.

- Dopamine addiction, lost focus, boredom → everyone feels it
- Existing focus apps nag but have **zero real consequence**
- No permanent, verifiable record of "I showed up"

> "I'm a dopamine addict. I lose focus daily. I needed consequence."

---

## Slide 3 — Insight

Everyone in crypto already understands **onchain proof**.

We don't sell a new primitive.
We redirect an existing behavior:

> **From:** flexing profit
> **To:** flexing discipline

The mechanics that fix dopamine addiction:
- **Loss aversion** → but here it's reputational, not financial
- **Gamification** → onchain streak, XP, level
- **Social proof** → shareable Lock-In Card
- **Monad speed** → logging a session is <1s, near-zero gas

---

## Slide 4 — Solution

Fokusle = a place to **build and show off consistency**.

1. Connect wallet (sign message — no gas, no account)
2. Start a focus timer (25 / 45 / 50 / 90 min)
3. Complete session → **log it onchain**
4. Earn XP, level, streak, and **soulbound badges**
5. Share your **Lock-In Card** to X / Telegram / Discord

No staking. No pool. No token. Just proof.

---

## Slide 5 — How it works

```
Wallet connect
   ↓
Sign message → login (identity, no gas)
   ↓
Start timer → focus session
   ↓
logFocus(seconds) → Monad testnet (write state)
   ↓
Contract updates: totalHours, streak, XP, level
   ↓
Milestone hit → soulbound NFT badge mints
   ↓
Generate Lock-In Card → share
```

State lives onchain. Nobody can fake your streak.

---

## Slide6 — Onchain component (Monad)

**Contract:** `Fokusle.sol` (Solidity 0.8.26)
**Deployed:** `0xAeCA5a0D414688C8b6bc7dEBa24124BB276d7D60`
**Network:** Monad Testnet (chainId 10143)
**Tooling:** Foundry deploy + test (8/8 passing)

**Real proof, not a database:**
- `commit(duration, sig)` — ECDSA signature checked onchain (wallet must sign intent)
- `logFocus` only works if committed & within window → **fake hours impossible**
- `getStreaks(address[])` — **parallel multicall** reads (showcases Monad parallel EVM)

Why Monad:
- Parallel EVM → cheap, fast session logging
- Testnet faucet → zero friction to try
- Fits hackathon instruction: "use Monad tooling"

---

## Slide 7 — Features / Differentiator

✅ Wallet login (sign, no account)
✅ Focus timer (25/45/50/90m)
✅ Onchain progress (hours, streak, weekly, XP, level)
✅ Soulbound badges: First Hour → 100 Hours → 30-Day Streak → Locked In
✅ **Lock-In Card** — flex discipline, 1-click share

🚫 Deliberately NOT built (yet):
staking · reward pool · token · treasury · DAO

> "We sell identity, not money."

---

## Slide 8 — Market + Fit + Ask

**Hackathon fit:**
- Solves a *personal* problem (the exact prompt)
- Practical > fancy tech
- Onchain component is real, not cosmetic

**Beyond hackathon:**
- Crypto natives already flex onchain → natural early adopters
- "Proof of X" is a growing narrative (proof of humanity, proof of work)
- Can add staking / groups / AI coach later if validated

**Ask:** Try it. Log a session. Flex something harder than PnL.

---
*Built by ASA MITAKA · Solves a problem I actually have.*
