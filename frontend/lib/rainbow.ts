import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monadTestnet } from "./wagmi";

// RainbowKit config WITHOUT WalletConnect (no projectId signup needed).
// MetaMask + injected (Rainbow, Coinbase, etc. as browser extensions) auto-detect.
export const rainbowConfig = getDefaultConfig({
  appName: "FokusLe",
  projectId: "fokusle-device-no-wc",
  chains: [monadTestnet as any],
  ssr: true,
});
