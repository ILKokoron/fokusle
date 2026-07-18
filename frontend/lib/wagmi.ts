import { http, createConfig } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
} as const;

export const config = getDefaultConfig({
  appName: "FokusLe",
  // TODO: replace with a real WalletConnect Cloud project ID before deploying.
  // Get one free at https://cloud.reown.com (2 min signup) — without a real ID,
  // the mobile wallet-connect flow (deep-linking to MetaMask/Rainbow/Trust Wallet
  // from a regular mobile browser) will not work.
  projectId: "focusproof-hackathon-spark",
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
});
