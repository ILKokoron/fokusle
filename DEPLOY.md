# DEPLOY.md — Instruksi dari laptop lo sendiri

Semua dijalankan di laptop/PC lo (bukan VPS). Butuh: Node.js 18+, Foundry (`forge`/`cast`), git.

## 1. Copy project ini ke laptop lo
Folder `fokusle/` (contract + frontend).
Butuh forge-std buat test: `git clone https://github.com/foundry-rs/forge-std lib/forge-std` di folder project.

## 2. Deploy contract ke Monad Testnet (Foundry) — opsional, udah gw deploy
```bash
export PK=0xYOUR_TESTNET_PRIVATE_KEY
forge create src/Fokusle.sol:Fokusle \
  --private-key $PK \
  --rpc-url https://testnet-rpc.monad.xyz \
  --legacy --broadcast
```
Copy address hasilnya ke `frontend/lib/abi.ts` line `FOKUSLE_ADDRESS`.
> Sudah deployed: ``

## 3. Isi faucet
https://testnet.monad.xyz/ → paste wallet address → claim.

## 4. Jalanin webapp
```bash
cd frontend
npm install
# kalau ERESOLVE: npm install --legacy-peer-deps
npm run dev
```
Buka http://localhost:3000

## 5. Test flow (commit-reveal)
1. Connect Wallet → MetaMask
2. Tambah network Monad Testnet (RPC https://testnet-rpc.monad.xyz, Chain ID 10143, Symbol MON)
3. Sign message → login (no gas)
4. Klik "Lock In & Start" → sign commit → timer jalan
5. Tunggu / skip → "Log Session Onchain"
6. Progress + badges update. Lock-In Card → Share X/Telegram/Discord

## 6. Demo video (3 menit)
- Connect + sign in
- Lock In 25m → log session → progress naik
- Tunjukin Lock-In Card → share ke X
- Tunjukin badge mint (First Hour setelah 1 jam total)
- Sebutin "proof" = signature-gated, gak bisa fake

## 7. Submission BuildAnything
- URL web app: `vercel` di folder frontend, atau `npm run dev` + ngrok
- GitHub repo: public
- Contract address: 0xAeCA5a0D414688C8b6bc7dEBa24124BB276d7D60
- Demo video: YouTube unlisted 3 menit
- Social post: X thread "Proof of Focus" (Most viral prize)
