import { http, createConfig, cookieStorage, createStorage } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
} as const;

// Storage fallback: avoid indexedDB dependency (crashes on mobile incognito /
// some WebViews where indexedDB is undefined). Use cookieStorage-safe localStorage.
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

export const config = getDefaultConfig({
  appName: "Fokusle",
  projectId: "fokusle-hackathon-spark",
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
  ssr: true,
  storage: noopStorage,
});
