import { http, createConfig, createStorage } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";

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

// metaMask() connector handles mobile deep-linking (opens MetaMask app when no
// injected provider is present). injected() covers desktop extension wallets.
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
