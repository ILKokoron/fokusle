# Fokusle - Pitch Deck

**Spark Hackathon · BuildAnything**
"Build anything onchain that solves a personal problem"

---

## Slide 1 - Title

# Fokusle
### Proof of Focus. Proof of Discipline.

A productivity app for Web3 users.
Wallet = identity. Consistency = onchain proof.

**Built by kokoron**

---

## Slide 2 - Problem

When I looked at this hackathon's goal, solving a real everyday problem, I realized I constantly lose focus while working on my laptop. The moment something loads, I get thirsty for dopamine and grab my phone for a quick hit without even noticing. I've been doing this for years.

But there's a bigger problem. Similar apps can't show how locked in you actually were while doing the work. In an era where validation matters more than ever, that makes the whole thing feel not worth doing.

- Dopamine addiction, lost focus, everyone feels it
- Existing focus apps nag but have zero real consequence
- No permanent, verifiable record of "I showed up"

> "I'm a dopamine addict. I lose focus daily. I needed consequence."

---

## Slide 3 - Insight

Everyone in crypto already understands onchain proof.

We don't sell a new primitive. We redirect an existing behavior:

> **From:** flexing profit
> **To:** flexing discipline

The mechanics that fix dopamine addiction:
- **Loss aversion** but here it's reputational, not financial
- **Gamification** onchain streak, XP, level
- **Social proof** shareable Lock-In Card
- **Monad speed** logging a session is under 1 second, near-zero gas

---

## Slide 4 - Solution

Fokusle = a place to build and show off consistency.

1. Connect wallet (sign message, no gas, no account)
2. Lock in a focus timer
3. Complete session, log it onchain
4. Earn XP, level, streak, and soulbound badges
5. Share your Lock-In Card to X / Telegram / Discord

No staking. No pool. No token. Just proof.

---

## Slide 5 - How it works

```
Wallet connect
   |
Sign message = login (identity, no gas)
   |
Lock in timer = focus session
   |
logFocus(seconds) = Monad testnet (write state)
   |
Contract updates: totalHours, streak, XP, level
   |
Milestone hit = soulbound badge mints
   |
Generate Lock-In Card = share
```

State lives onchain. Nobody can fake your streak.

---

## Slide 6 - Onchain component (Monad)

**Contract:** `Fokusle.sol` (Solidity 0.8.26)
**Deployed:** `0x225791c36d31115e0393f3Baca9bdAc1fa0f2fF7`
**Network:** Monad Testnet (chainId 10143)
**Tooling:** Foundry deploy + test (all passing)

**Real proof, not a database:**
- `commit(duration, sig)`, ECDSA signature checked onchain, wallet must sign intent
- `logFocus` only works if committed and within window, fake hours impossible
- `getStreaks(address[])`, parallel multicall reads, showcases Monad parallel EVM

Why Monad:
- Parallel EVM, cheap and fast session logging
- Testnet faucet, zero friction to try
- Fits hackathon instruction: use Monad tooling

---

## Slide 7 - Features / Differentiator

- Wallet login (sign, no account)
- Focus timer with live percent ring
- Onchain progress (hours, streak, weekly, XP, level)
- Soulbound badges: First Hour to 100 Hours to 30-Day Streak to Locked In
- Lock-In Card, flex discipline, 1-click share
- Onchain identity: name and picture follow your wallet to any device

Deliberately NOT built (yet):
staking, reward pool, token, treasury, DAO

> "We sell identity, not money."

---

## Slide 8 - Market + Fit + Ask

**Hackathon fit:**
- Solves a personal problem, the exact prompt
- Practical over fancy tech
- Onchain component is real, not cosmetic

**Beyond hackathon:**
- Crypto natives already flex onchain, natural early adopters
- Proof of X is a growing narrative (proof of humanity, proof of work)
- v2 native app with real activity detection, buddy rooms, focus chart

**Ask:** Try it. Log a session. Flex something harder than PnL.

---

*Built by kokoron. Solves a problem I actually have.*
