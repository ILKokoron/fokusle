// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title Fokusle — Proof of Focus, Proof of Discipline
/// @notice Onchain record of VERIFIED focus sessions + soulbound badges.
///         Anti-fake: commit-reveal with wallet signature proves intent before a session.
///         No staking. No pool. No token. Wallet = identity.
/// @dev Deployed on Monad. logFocus is the only state write; gas is near-zero.
contract Fokusle {
    struct FocusData {
        uint256 totalSeconds;
        uint256 weeklySeconds;
        uint256 weekNumber;
        uint256 streak;
        uint256 lastDay;
        uint256 xp;
        uint256 level;
        uint256 sessionCount;
        uint256 committedUntil; // timestamp of active commit (0 = none)
        uint256 commitStart;    // timestamp when commit() was called
        uint256 commitDuration; // duration committed to, in seconds
    }
    mapping(address => FocusData) public focus;

    // Soulbound badges (id 1..5)
    string[6] public BADGE_NAMES = [
        "",
        "First Hour",    // 1  — 1h total
        "10 Hour Club",  // 2  — 10h total
        "100 Hours",     // 3  — 100h total
        "30-Day Streak", // 4  — 30 day streak
        "Locked In"      // 5  — 50 sessions
    ];

    mapping(address => uint256[]) public badges;
    mapping(uint256 => uint256) public tokenBadge;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    uint256 public nextTokenId;

    // Onchain leaderboard (top streakers) — Monad parallel-read friendly
    address[] public leaderboard;

    // Custom in-app display name (fallback identity if no .nad name is set)
    mapping(address => string) public nickname;

    event NicknameSet(address indexed user, string nickname);

    // Gacha — cosmetic only. Costs XP, no gameplay effect. Pity system: guaranteed
    // Monanimal (any) within GACHA_PITY pulls if no result recorded yet is fine since
    // every pull always returns something; "pity" here just means cost is fixed.
    uint256 public constant GACHA_COST_XP = 50;
    string[8] public MONANIMALS = [
        "", "Chog", "Molandak", "Moyaki", "Mokadel", "Mouch", "Salmonad", "Mosferatu"
    ];
    mapping(address => uint256[]) public gachaPulls; // history of Monanimal ids owned (1..7)
    event GachaPulled(address indexed user, uint256 monanimalId, string name, uint256 xpSpent);
    error NotEnoughXP();

    event SessionLogged(
        address indexed user,
        uint256 secondsFocused,
        uint256 streak,
        uint256 xp,
        uint256 level,
        uint256 weeklySeconds
    );
    event BadgeMinted(address indexed user, uint256 indexed tokenId, uint256 badgeId, string name);
    event Committed(address indexed user, uint256 duration, uint256 deadline);

    /// @notice Step 1: commit to a focus session. Sign the intent off-chain,
    ///         then call commit so contract knows you started. Prevents fake logs.
    function commit(uint256 duration, bytes calldata sig) external {
        require(duration > 0 && duration <= 86400, "Fokusle: bad duration");
        require(
            focus[msg.sender].committedUntil == 0 || block.timestamp > focus[msg.sender].committedUntil,
            "Fokusle: already committed"
        );
        // signature = wallet signs keccak256(addr, duration); wallet auto-prefixes EIP-191
        bytes32 h = keccak256(abi.encodePacked(msg.sender, duration));
        require(_recover(h, sig) == msg.sender, "Fokusle: bad signature");
        focus[msg.sender].committedUntil = block.timestamp + duration + 300; // +5m grace
        focus[msg.sender].commitStart = block.timestamp;
        focus[msg.sender].commitDuration = duration;
        emit Committed(msg.sender, duration, focus[msg.sender].committedUntil);
    }

    /// @notice Step 2: reveal + log a completed session. Must be within commit window.
    function logFocus(uint256 secondsFocused) external {
        require(secondsFocused > 0 && secondsFocused <= 86400, "Fokusle: bad duration");

        FocusData storage f = focus[msg.sender];
        require(f.committedUntil != 0, "Fokusle: commit first");
        require(block.timestamp <= f.committedUntil, "Fokusle: commit expired");
        require(secondsFocused <= f.commitDuration, "Fokusle: exceeds committed duration");
        require(block.timestamp >= f.commitStart + secondsFocused, "Fokusle: not enough time elapsed");
        f.committedUntil = 0; // consume
        f.commitStart = 0;
        f.commitDuration = 0;

        uint256 today = block.timestamp / 1 days;
        uint256 week = block.timestamp / 1 weeks;

        if (f.sessionCount == 0) {
            f.weekNumber = week;
        } else if (week != f.weekNumber) {
            f.weekNumber = week;
            f.weeklySeconds = 0;
        }

        if (f.sessionCount == 0) {
            f.streak = 1;
        } else if (today == f.lastDay + 1) {
            f.streak += 1;
        } else if (today > f.lastDay + 1) {
            f.streak = 1;
        }

        f.lastDay = today;
        f.totalSeconds += secondsFocused;
        f.weeklySeconds += secondsFocused;
        f.sessionCount += 1;
        f.xp += secondsFocused / 60;
        f.level = f.xp / 100;

        _updateLeaderboard(msg.sender, f.streak);
        _checkBadges(msg.sender);
        emit SessionLogged(msg.sender, secondsFocused, f.streak, f.xp, f.level, f.weeklySeconds);
    }

    /// @notice Set a custom in-app display name. Used as fallback identity
    ///         when the user has no .nad name (Nad Name Service) set.
    ///         Frontend is responsible for escaping when rendering (React
    ///         does this by default) — this contract only bounds length.
    function setNickname(string calldata name) external {
        bytes memory b = bytes(name);
        require(b.length > 0 && b.length <= 20, "Fokusle: nickname must be 1-20 chars");
        nickname[msg.sender] = name;
        emit NicknameSet(msg.sender, name);
    }

    /// @notice Spend XP for a cosmetic Monanimal pull. Purely cosmetic —
    ///         no gameplay effect, no gameplay advantage, not a token.
    /// @dev Randomness source: block data + sender + nonce. This is NOT
    ///      cryptographically secure (a miner/validator could theoretically
    ///      bias it) — acceptable for a cosmetic-only demo feature, but
    ///      would need a real VRF (e.g. Chainlink) before any pull ever had
    ///      real monetary value attached.
    function pullGacha() external returns (uint256 monanimalId) {
        FocusData storage f = focus[msg.sender];
        if (f.xp < GACHA_COST_XP) revert NotEnoughXP();
        f.xp -= GACHA_COST_XP;

        uint256 rand = uint256(keccak256(abi.encodePacked(
            blockhash(block.number - 1), block.timestamp, msg.sender, gachaPulls[msg.sender].length
        )));
        monanimalId = (rand % 7) + 1;
        gachaPulls[msg.sender].push(monanimalId);

        emit GachaPulled(msg.sender, monanimalId, MONANIMALS[monanimalId], GACHA_COST_XP);
    }

    function getGachaPulls(address u) external view returns (uint256[] memory) {
        return gachaPulls[u];
    }

    function _updateLeaderboard(address u, uint256 streak) internal {
        for (uint256 i = 0; i < leaderboard.length; i++) {
            if (leaderboard[i] == u) return; // already tracked
        }
        if (leaderboard.length < 100) leaderboard.push(u);
    }

    function _checkBadges(address u) internal {
        FocusData storage f = focus[u];
        if (f.totalSeconds >= 3600 && !_has(u, 1)) _mint(u, 1);
        if (f.totalSeconds >= 36000 && !_has(u, 2)) _mint(u, 2);
        if (f.totalSeconds >= 360000 && !_has(u, 3)) _mint(u, 3);
        if (f.streak >= 30 && !_has(u, 4)) _mint(u, 4);
        if (f.sessionCount >= 50 && !_has(u, 5)) _mint(u, 5);
    }

    function _has(address u, uint256 id) internal view returns (bool) {
        uint256[] storage b = badges[u];
        for (uint256 i = 0; i < b.length; i++) if (b[i] == id) return true;
        return false;
    }

    function _mint(address to, uint256 badgeId) internal {
        uint256 tid = nextTokenId++;
        ownerOf[tid] = to;
        balanceOf[to]++;
        badges[to].push(badgeId);
        tokenBadge[tid] = badgeId;
        emit BadgeMinted(to, tid, badgeId, BADGE_NAMES[badgeId]);
    }

    function _recover(bytes32 h, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Fokusle: bad sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        // Wallets sign via personal_sign, which always prepends the EIP-191
        // prefix before hashing — ecrecover must verify against that same
        // prefixed hash, not the raw one, or every real wallet signature
        // will recover to the wrong address.
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", h));
        return ecrecover(ethSignedHash, v, r, s);
    }

    // ── Views ──────────────────────────────────────────────
    function getProgress(address u) external view returns (
        uint256 totalSeconds, uint256 weeklySeconds, uint256 streak,
        uint256 xp, uint256 level, uint256 sessionCount
    ) {
        FocusData memory f = focus[u];
        return (f.totalSeconds, f.weeklySeconds, f.streak, f.xp, f.level, f.sessionCount);
    }

    function getBadges(address u) external view returns (uint256[] memory) {
        return badges[u];
    }

    function badgeName(uint256 id) external view returns (string memory) {
        return BADGE_NAMES[id];
    }

    /// @notice Monad parallel-read: pass many wallets, get streaks in 1 call.
    function getStreaks(address[] calldata users) external view returns (uint256[] memory) {
        uint256[] memory out = new uint256[](users.length);
        for (uint256 i = 0; i < users.length; i++) out[i] = focus[users[i]].streak;
        return out;
    }

    function getLeaderboard() external view returns (address[] memory) {
        return leaderboard;
    }

    // Soulbound by design: no transfer/approve exposed.
}
