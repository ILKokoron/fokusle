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

// Custom injected connectors for Rabby + OKX (detect window flag).
const rabby = injected({ target: "rabby", shimDisconnect: true });
const okx = injected({ target: "okxWallet", shimDisconnect: true });

// metaMask() deep-links to app on mobile. injected() covers generic + Rainbow
// desktop extension. Rabby/OKX added for broader wallet picker.
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [
    metaMask({
      dappMetadata: { name: "FokusLe", url: "https://fokusle.vercel.app" },
    }),
    injected({ shimDisconnect: true }),
    rabby,
    okx,
  ],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
  ssr: true,
  storage: noopStorage,
});

// Display metadata for the connect picker UI.
export const WALLET_PICKER = [
  { id: "metaMask", name: "MetaMask", emoji: "🦊", note: "Opens app on mobile" },
  { id: "rabby", name: "Rabby", emoji: "🐰", note: "Extension / mobile" },
  { id: "okxWallet", name: "OKX Wallet", emoji: "⭕", note: "Exchange wallet" },
  { id: "injected", name: "Rainbow / Other", emoji: "🌈", note: "Browser wallet" },
] as const;
