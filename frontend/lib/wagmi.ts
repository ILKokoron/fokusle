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
  appName: "Fokusle",
  projectId: "fokusle-hackathon-spark",
  chains: [monadTestnet],
  transports: { [monadTestnet.id]: http("https://testnet-rpc.monad.xyz") },
});
