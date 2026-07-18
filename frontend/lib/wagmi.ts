import { http, createConfig, createStorage } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadVision", url: "https://testnet.monadvision.com" } },
  testnet: true,
} as const;

const noopStorage = createStorage({
  storage: {
    getItem: (key: string) => {
      if (typeof window === "undefined") return null;
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    setItem: (key: string, value: string) => {
      if (typeof window === "undefined") return;
      try { window.localStorage.setItem(key, value); } catch {}
    },
    removeItem: (key: string) => {
      if (typeof window === "undefined") return;
      try { window.localStorage.removeItem(key); } catch {}
    },
  },
});

// metaMask() deep-links to app on mobile. injected() covers generic browser
// wallets (Rainbow, Coinbase, etc. in Chrome) + desktop extensions.
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    metaMask({
      dappMetadata: { name: "FokusLe", url: "https://fokusle.vercel.app" },
    }),
    injected({ shimDisconnect: true }),
  ],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
  ssr: true,
  storage: noopStorage,
});

// Display metadata for the connect picker UI.
export const WALLET_PICKER = [
  { id: "metaMask", name: "MetaMask", emoji: "🦊", note: "Opens app on mobile" },
  { id: "injected", name: "Browser Wallet", emoji: "🌐", note: "Rainbow, Coinbase, etc. (Chrome)" },
] as const;
