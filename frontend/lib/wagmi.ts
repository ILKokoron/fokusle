import { http, createConfig, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";

export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" } },
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

// Pure wagmi: injected connector only (browser wallet / MetaMask).
// No RainbowKit / WalletConnect => no indexedDB dependency => no mobile crash.
export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
  ssr: true,
  storage: noopStorage,
});
