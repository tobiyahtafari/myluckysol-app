# MyLuckySol - Provably Fair Solana Chance Game

## Project Overview
MyLuckySol is a casino-grade, provably fair chance-based game DApp on Solana. Players can wager SOL and compete in various game modes for a chance to win 90% of the pool. The game uses VRF for provably fair randomness and rewards players with WAGA tokens.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js
- **Styling**: TailwindCSS + Framer Motion
- **State Management**: Zustand + TanStack Query
- **Wallet**: Multi-wallet support (Phantom, OKX, Solflare, Backpack)
- **Blockchain**: Solana (devnet for testing, mainnet for production)

## Game Modes
1. **1v1 Mode**: 2 players, 1 round, 90s timer (1 min 30 sec)
2. **2-Round Mode**: 4 players, 2 rounds, 90s timer (1 min 30 sec)
3. **3-Round Mode**: 8 players, 3 rounds, 90s timer (1 min 30 sec)
4. **4-Round Mode**: 16 players, 4 rounds, 90s timer (1 min 30 sec)

## Wager Tiers
- 0.01 SOL
- 0.1 SOL
- 1 SOL
- 10 SOL

## Payout Rules
- 90% of pool goes to winner(s)
- 10% goes to Foundation Treasury (dev wallet earnings)

## WAGA Token Rewards
- Entry Reward: 100x SOL wager match (on entry, transferred immediately from vault). e.g. 0.01 SOL = 1 WAGA, 1 SOL = 100 WAGA
- Win Bonus: 1000x SOL won match (final winner only, goes to vesting). e.g. 0.018 SOL won = 18 WAGA, 144 SOL won = 144,000 WAGA
- Referral Reward: 100 WAGA each for referrer and referred user (transferred from vault when referred user sets username)

## Project Structure
```
client/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── GameModeCard.tsx
│   │   ├── WagerSelector.tsx
│   │   ├── CountdownTimer.tsx
│   │   ├── PlayerSlot.tsx
│   │   ├── LuckBar.tsx
│   │   └── WinnerReveal.tsx
│   ├── lib/
│   │   ├── wallet-context.tsx  # Wallet provider
│   │   ├── game-store.ts       # Zustand store
│   │   ├── polyfills.ts        # Buffer polyfill for browser Solana
│   │   └── queryClient.ts      # TanStack Query client
│   ├── pages/
│   │   ├── Home.tsx            # Landing page
│   │   ├── Play.tsx            # Game lobby
│   │   ├── GameRoom.tsx        # Active game view
│   │   ├── Profile.tsx         # Player profile, username, referrals, vesting
│   │   └── Leaderboard.tsx     # Rankings
│   └── App.tsx
server/
├── routes.ts               # API endpoints
├── storage.ts              # In-memory storage & game logic
├── solana-client.ts         # Solana blockchain interactions (escrow, payouts, WAGA transfers)
├── price-service.ts         # SOL/USD price feed, WAGA calculations
├── waga-service.ts          # WAGA reward helper service
└── index.ts
shared/
├── schema.ts               # Shared types, schemas, and constants
└── constants.ts             # Wallet addresses, program IDs, payout splits
```

## API Endpoints
- `POST /api/games/prepare` - Get escrow PDA/authority wallet for SOL transfer
- `POST /api/games/join` - Join or create a game (validates tx on-chain)
- `GET /api/games/:id` - Get game by ID
- `POST /api/games/:id/claim` - Get claim_winnings transaction for winner
- `GET /api/profile/:walletAddress` - Get player profile
- `GET /api/profile/:walletAddress/history` - Get game history
- `PATCH /api/profile/:walletAddress` - Update username (requires SOL payment tx), avatar, or referral
- `GET /api/profile/:walletAddress/username-cost` - Get SOL cost for username update + payment address
- `GET /api/profile/:walletAddress/vesting` - Get WAGA vesting status
- `POST /api/profile/:walletAddress/claim-vesting` - Claim vested WAGA (on-chain transfer from vault)
- `GET /api/leaderboard?sortBy=earnings|luck|streaks` - Get leaderboard (real player data)

## Design System
- **Background**: Dark (#0f0f17)
- **Primary**: Gold (#F5B800) - for CTA buttons, highlights
- **Secondary**: Purple (#9945FF) - Solana purple accent
- **Accent**: Green (#22c55e) - win states, luck indicator
- **Gradients**: Solana gradient (cyan -> blue -> purple -> pink)

## User Preferences
- Dark theme only (casino aesthetic)
- No emoji usage
- Space Grotesk font family
- Framer Motion for animations

## Wallet Integration
The app supports multiple Solana wallets:
- **Phantom**: Most popular Solana wallet
- **OKX Wallet**: Multi-chain wallet with Solana support
- **Solflare**: Solana-native wallet
- **Backpack**: xNFT-enabled wallet

### Network Switching
- Users can toggle between Devnet and Mainnet via the network badge in the header
- Devnet users can request free SOL airdrops for testing
- Network preference is persisted in localStorage
- Mainnet switching requires a confirmation dialog to prevent accidental SOL usage

### Wallet Connection Flow
1. Click "Connect Wallet" in header
2. Select from available wallets in modal
3. Approve connection in wallet extension
4. View balance and network in dropdown menu
5. Wallet auto-reconnects on page load using event listeners

## Solana Wallets & Programs (Devnet)

### Key Wallets
| Wallet | Address | Purpose |
|--------|---------|---------|
| Foundation Treasury | `BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP` | Receives 10% house fee from game winnings + username update SOL payments (dev earnings wallet) |
| Authority/Rewards Vault | `9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf` | Signs on-chain transactions, holds WAGA tokens for all reward distributions |
| WAGA Vault ATA | `66bMApCZTRGqfxAXBML6dPAEJX1VwAsBR1DrfwsLaJr1` | Associated Token Account that holds WAGA supply for rewards |

### Programs & Tokens
| Asset | Address | Status |
|-------|---------|--------|
| MyLuckySol Program | `Hiu3MhgaUWZS38pugERhxrjH4J3dJ1qcbzbtgXScBpd5` | NOT YET DEPLOYED (see deployment section) |
| WAGA Token Mint | `9XU2yJhhAJ1FoUZXbMchZvQMLHui2LQ2a4HC6vaer3JV` | Active on devnet |

### SOL Payment Flows (who receives what)
1. **Game wagers**: SOL goes to authority wallet (fallback mode) or escrow PDA (full on-chain mode)
2. **Game payouts**: 90% to winner, 10% to Foundation Treasury (`BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP`)
3. **Username update fees**: SOL goes to Foundation Treasury (`BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP`)

### WAGA Distribution Flows (all from Rewards Vault)
All WAGA token transfers come from the Rewards Vault (`9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf`) via its ATA:
1. **Entry rewards**: Transferred immediately when player joins a game (100x SOL wager)
2. **Referral rewards**: Transferred when referred user sets their username (100 WAGA each to referrer + referred)
3. **Vesting claims**: Transferred when winner claims vested WAGA (10% daily release of winner rewards)

### WAGA Token Setup for Devnet Testing
To fund the Rewards Vault with test WAGA tokens:
1. Send WAGA tokens to the Vault ATA: `66bMApCZTRGqfxAXBML6dPAEJX1VwAsBR1DrfwsLaJr1`
2. The WAGA token mint address on devnet: `9XU2yJhhAJ1FoUZXbMchZvQMLHui2LQ2a4HC6vaer3JV`
3. The authority wallet (`9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf`) signs all WAGA transfers from this vault
4. This single vault handles ALL WAGA distributions: entry rewards, referral rewards, win rewards (vesting), and vesting claims

## Program Deployment Status (2026-01-28)
**Current Status**: The MyLuckySol Anchor program is NOT deployed on devnet yet. The app runs in **fallback mode** which uses direct SOL transfers to the authority wallet instead of PDA-based escrow.

**Why it can't be deployed from Replit**:
- Recent crates.io updates (blake3 v1.8.3, constant_time_eq v0.4.2) require Rust `edition2024`
- Replit's bundled Solana tools (v1.17.31) use Cargo 1.77 which doesn't support edition2024
- This is a temporary environment limitation that will be resolved when Replit updates its Rust toolchain

**To deploy from a local machine**:
1. Install Rust 1.85+ and Solana CLI 1.18+
2. Install Anchor CLI: `cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --tag v0.30.1`
3. Clone the repo and navigate to the project root
4. Configure Anchor wallet: Set `ANCHOR_WALLET` env var to keypair file path, or update `wallet` in `Anchor.toml`
5. Build: `anchor build`
6. Deploy: `anchor deploy --provider.cluster devnet`

Note: `SOLANA_AUTHORITY_PRIVATE_KEY` is for server runtime only. Anchor uses its own wallet config for deployment.

## On-Chain Transaction Flow

**Fallback Mode (current)**:
1. Player joins game -> Signs SOL transfer to authority wallet
2. Transaction confirms on Solana devnet
3. Backend registers player in game after tx confirmation
4. When game ends: authority wallet pays 90% to winner, 10% to treasury

**Full On-Chain Mode (after program deployment)**:
1. Player joins game -> Signs join_game instruction (SOL to escrow PDA)
2. Transaction confirms on Solana devnet
3. Backend validates join_game instruction + wager amount
4. When game ends: finalize_game pays 10% treasury, winner claims 90%

## WAGA Token Vesting System
- **Winner rewards go to vesting**, NOT immediately to wallet
- Total WAGA vesting is tracked in player profile (`wagaVestingTotal`, `wagaVestingClaimed`)
- **10% daily release**: Every 24 hours, players can claim 10% of their total vesting amount
- Profile page shows vesting progress bar, remaining balance, and claim button
- This prevents market dumping by gradual token release
- Entry rewards (from joining games) are still immediate
- Vesting claims trigger on-chain WAGA transfer from vault to player's wallet

### WAGA Reward Flow
1. **Entry Reward**: Player joins game -> WAGA transferred immediately from vault to player (100x SOL wager match)
2. **Winner Reward**: Game completes -> Winner's 1000x SOL match in WAGA goes to vesting pool
3. **Daily Claim**: Winner can claim 10% of vesting per 24 hours on Profile page (on-chain transfer)
4. **Referral Reward**: Both users receive 100 WAGA (on-chain transfer from vault) when referred user sets username

## Anti-Abuse Referral Program (2026-02-12)
- **Username gating**: Referral Program is locked until user sets a username
- **Username update cost**: $1 worth of SOL (spot price) for first update, $0.50 for subsequent updates
- **Payment destination**: SOL payments go to Foundation Treasury wallet (same wallet that receives 10% of game winnings)
- **Payment verification**: Backend strictly validates SOL transfer - checks confirmation, sender, recipient (treasury), and exact amount
- **Deferred referral rewards**: Both referrer and referred user receive 100 WAGA ONLY after the referred user sets their username
- **On-chain referral WAGA**: When referral rewards trigger, WAGA is transferred from the Rewards Vault to both wallets on-chain
- **Anti-abuse**: Referral code can only be entered BEFORE first username set (server enforced)
- **72-hour cooldown**: Username can only be changed once every 72 hours

### Referral Flow
1. User A sets username (pays $1 SOL to treasury) -> referral program unlocked -> gets referral link
2. User B enters referral code -> registered as pending
3. User B sets username (pays $1 SOL to treasury) -> both User A and User B receive 100 WAGA (on-chain from vault)

## Environment Variables
- `SOLANA_AUTHORITY_PRIVATE_KEY` (secret, required) - Base58-encoded private key for authority wallet. Used for: signing on-chain game transactions, transferring WAGA from vault, executing payouts
- `SESSION_SECRET` (secret) - Express session secret

## Key Files
- `server/routes.ts`: API endpoints, wallet validation, WAGA reward calculations, username payment verification
- `server/storage.ts`: Game state management, WAGA reward distribution (100x entry, 1000x winner), referral rewards
- `server/solana-client.ts`: Solana blockchain interactions - escrow, payouts, WAGA token transfers from vault
- `server/price-service.ts`: SOL/USD price feed via CoinGecko, WAGA value calculations, username cost computation
- `server/waga-service.ts`: WAGA reward helper service
- `shared/schema.ts`: WAGA_ENTRY_MULTIPLIER, WAGA_WINNER_MULTIPLIER, REFERRAL_REWARD_AMOUNT constants
- `shared/constants.ts`: Treasury wallet, program ID, token mint, vault addresses, payout split
- `client/src/pages/Play.tsx`: On-chain SOL transfers with wallet signing
- `client/src/pages/Profile.tsx`: Username updates with SOL payment, referral program, vesting claims
- `client/src/components/WagerSelector.tsx`: Displays WAGA entry rewards per wager tier
- `client/src/lib/wallet-context.tsx`: Syncs WAGA balance from profile
- `client/src/lib/polyfills.ts`: Buffer polyfill for browser Solana compatibility

## Architecture Notes
- Backend validates joins and tracks WAGA rewards in player profiles
- Games start automatically when all player slots are filled (no bots, real wallets only)
- On-chain SOL transfers enabled via Buffer polyfill for browser compatibility
- All WAGA transfers are on-chain from the single Rewards Vault
- Username payments and 10% house fees both go to Foundation Treasury (dev earnings)
- Network: Running on Devnet for testing, ready for mainnet migration
