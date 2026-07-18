# Fokusle - Proof of Focus, Proof of Discipline

**Spark Hackathon (BuildAnything) submission.**

> "Build something practical that solves a real problem YOU have."

## The problem
When I looked at this hackathon's goal, solving a real everyday problem or even one your friends have, I realized I constantly lose focus while working on my laptop. The moment something loads, I get thirsty for dopamine and grab my phone for a quick hit without even noticing. I've been doing this for years without realizing it.

But there's a bigger problem. Similar apps can't show how locked in you actually were while doing the work. In an era where validation matters more than ever to some people, that makes the whole thing feel not worth doing. That's why I built this app for the hackathon. Why did I make it? Because watching people flex PnL on the timeline gets more boring and honestly a bit corny over time. So I built something not everyone has, proof of how locked in you were during your productive hours.

Sure, there's the argument that users could cheat, or use a second device to keep the timer running. But is that kind of win what someone serious about their time and self-respect is actually after? Of course not. So lock in, starting now, with Fokusle, where your productive time finally gets the respect it deserves.

## The solution
Fokusle makes focus **verifiable**. You commit to a session by signing a message (wallet = identity). The signature is checked onchain before any session counts. No commit, no log. No fake hours.

Then you build onchain proof: total hours, daily streak, weekly focus, XP, level, plus **soulbound badges** you can't buy, only earn.

> "Everyone flexes their PnL. We help people flex something harder: consistency."

## Stack (per hackathon instructions)
- **Smart contract**: Solidity, deployed via **Foundry** on **Monad Testnet**
- **Frontend**: Next.js + **viem** + **wagmi** + RainbowKit
- **Auth**: Sign message (no gas), wallet = identity
- **Proof**: commit-reveal with ECDSA signature verification onchain
- **Monad**: parallel `getStreaks(address[])` leaderboard read
- **Chain**: Monad Testnet (chainId 10143)

## Contract
- Address: `0x2936B3C6E8072133f280109acD43e6530661DAC1`
- Explorer: https://testnet.monadvision.com/address/0x2936B3C6E8072133f280109acD43e6530661DAC1
- Network: Monad Testnet
- App: https://fokusle.vercel.app

## How "Proof" works (anti-fake)
1. User picks duration, clicks **Lock In**
2. Frontend signs `keccak256(addr, duration, timestamp)` with wallet
3. `commit(duration, sig)`, contract recovers signer, must == caller
4. Timer runs; on complete, `logFocus(seconds)`, only works if committed & within window
5. State updates onchain. Fake logs impossible without the wallet's signature.

## Features
- Wallet login (sign message, no account needed)
- Verified focus sessions via wallet signature (no commit, no log)
- Onchain progress: total hours, streak, weekly focus, XP, level
- Soulbound achievement badges (First Hour to Locked In), can't be bought, only earned
- Parallel leaderboard (`getStreaks` multicall)
- Lock-In Card with 1-click share to X / Telegram / Discord
- Onchain identity: display name + profile picture stored in the contract, follows your wallet to any device
- No staking. No pool. No token.

## Product philosophy
Fokusle is built for people who want a focus app that feels different from the usual ones, light gamification, not hardcore restriction. The point isn't to be the strictest productivity tool. It's to make showing up daily feel real, and to make that proof portable and yours.

On web, a session is a verified presence: you lock in, the timer runs, you finish, the chain records it. We're honest about the limit, a web app can't tell if you put the phone down and scrolled TikTok on another device. The anti-cheat (signature + nonce) stops fake logs and streak inflation, not lack of discipline. Real activity detection comes in the native version (see Roadmap).

Crypto wallets are still early, but they're heading toward being as normal as a regular wallet. As wallets spread, logging into Fokusle gets easier for everyone, no new account, no password, your focus history travels with your address. The leaderboard and the flex card already create the social layer: you see others, you share your lock-in, you compare streaks.

The schizo card and the badges are on purpose. Attention is the economy now. Making discipline something you actually want to post is the whole point.

## Roadmap
- v2: native Android + iOS app. Phone-lock and motion detection so a session dies if the device is picked up, real focus verification, not just presence.
- Grace day on streak: miss one day, streak survives.
- Focus rooms / buddy system: lock in with a partner, both fail if one bails. Accountability keeps people coming back.
- 7-day focus chart so progress feels visible, not just a number.
- Quality-of-focus signal beyond raw duration (deep work vs passive reading) once native telemetry exists.

## Why this wins
- Real proof, not a database, signature-gated sessions, replay-proof nonces
- Monad-native: parallel streak reads showcase the parallel EVM
- Portable identity: name and picture live onchain, no account silo
- Sells discipline, not money, counter-narrative to PnL-flexing
- Solves a problem the builder actually has (exact hackathon prompt)

---
Built by kokoron. Solves a problem I actually have.
