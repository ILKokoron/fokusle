// Fokusle ABI (deployed on Monad Testnet)
export const FOKUSLE_ADDRESS = "0x08F71A7564336D176563ED971704EEAd37229D6b" as const;

export const FOKUSLE_ABI = [
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "duration", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "logFocus",
    stateMutability: "nonpayable",
    inputs: [{ name: "secondsFocused", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getProgress",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }],
    outputs: [
      { name: "totalSeconds", type: "uint256" },
      { name: "weeklySeconds", type: "uint256" },
      { name: "streak", type: "uint256" },
      { name: "xp", type: "uint256" },
      { name: "level", type: "uint256" },
      { name: "sessionCount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "nickname",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "getBadges",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getStreaks",
    stateMutability: "view",
    inputs: [{ name: "users", type: "address[]" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "getLeaderboard",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "badgeName",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "SessionLogged",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "secondsFocused", type: "uint256", indexed: false },
      { name: "streak", type: "uint256", indexed: false },
      { name: "xp", type: "uint256", indexed: false },
      { name: "level", type: "uint256", indexed: false },
      { name: "weeklySeconds", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BadgeMinted",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "badgeId", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Committed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "duration", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
] as const;

export const BADGE_META: Record<number, { icon: string; name: string }> = {
  1: { icon: "🥉", name: "First Hour" },
  2: { icon: "🥈", name: "10 Hour Club" },
  3: { icon: "🥇", name: "100 Hours" },
  4: { icon: "🔥", name: "30-Day Streak" },
  5: { icon: "💎", name: "Locked In" },
};
