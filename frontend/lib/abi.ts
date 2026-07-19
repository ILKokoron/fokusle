// FokusLe ABI (deployed on Monad Testnet)
export const FOCUSPROOF_ADDRESS = "0x225791c36d31115e0393f3Baca9bdAc1fa0f2fF7" as const;

export const FOCUSPROOF_ABI = [
  {
    type: "function",
    name: "logFocus",
    stateMutability: "nonpayable",
    inputs: [
      { name: "secondsFocused", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
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
    type: "function",
    name: "setNickname",
    stateMutability: "nonpayable",
    inputs: [{ name: "name", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "nickname",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "setAvatar",
    stateMutability: "nonpayable",
    inputs: [{ name: "dataUrl", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "avatar",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "pullGacha",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "monanimalId", type: "uint256" }],
  },
  {
    type: "function",
    name: "getGachaPulls",
    stateMutability: "view",
    inputs: [{ name: "u", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "GACHA_COST_XP",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "MONANIMALS",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "event",
    name: "GachaPulled",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "monanimalId", type: "uint256", indexed: false },
      { name: "name", type: "string", indexed: false },
      { name: "xpSpent", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "NicknameSet",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "nickname", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AvatarSet",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "avatar", type: "string", indexed: false },
    ],
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

export const MONANIMAL_NAMES: Record<number, string> = {
  1: "Chog", 2: "Molandak", 3: "Moyaki", 4: "Mokadel", 5: "Mouch", 6: "Salmonad", 7: "Mosferatu",
};

export const BADGE_META: Record<number, { icon: string; name: string }> = {
  1: { icon: "I", name: "First Hour" },
  2: { icon: "II", name: "10 Hour Club" },
  3: { icon: "III", name: "100 Hours" },
  4: { icon: "30D", name: "30-Day Streak" },
  5: { icon: "L", name: "Locked In" },
};
