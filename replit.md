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
- 10% goes to foundation treasury

## WAGA Token Rewards
- Entry Reward: 10 × SOL wager (on entry)
- Win Bonus: 100 × SOL won (final winner only)

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
│   │   └── queryClient.ts      # TanStack Query client
│   ├── pages/
│   │   ├── Home.tsx            # Landing page
│   │   ├── Play.tsx            # Game lobby
│   │   ├── GameRoom.tsx        # Active game view
│   │   ├── Profile.tsx         # Player profile
│   │   └── Leaderboard.tsx     # Rankings
│   └── App.tsx
server/
├── routes.ts               # API endpoints
├── storage.ts              # In-memory storage
└── index.ts
shared/
└── schema.ts               # Shared types and schemas
```

## API Endpoints
- `POST /api/games/prepare` - Get escrow PDA before SOL transfer
- `POST /api/games/join` - Join or create a game
- `GET /api/games/:id` - Get game by ID
- `GET /api/profile/:walletAddress` - Get player profile
- `GET /api/profile/:walletAddress/history` - Get game history
- `GET /api/profile/:walletAddress/vesting` - Get WAGA vesting status
- `POST /api/profile/:walletAddress/claim-vesting` - Claim vested WAGA
- `GET /api/leaderboard?sortBy=earnings|luck|streaks` - Get leaderboard (real player data)

## Design System
- **Background**: Dark (#0f0f17)
- **Primary**: Gold (#F5B800) - for CTA buttons, highlights
- **Secondary**: Purple (#9945FF) - Solana purple accent
- **Accent**: Green (#22c55e) - win states, luck indicator
- **Gradients**: Solana gradient (cyan → blue → purple → pink)

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

## Solana Programs
See `SOLANA_PROGRAMS.md` for detailed documentation. Deployment is handled via `scripts/deploy-devnet.sh` in the Replit Shell.

## Recent Changes (2026-01-27)

### On-Chain Escrow Integration
- **Two-step game join flow**: Frontend calls `/api/games/prepare` to get escrow PDA, then transfers SOL to escrow, then calls `/api/games/join` to confirm
- **Escrow PDA derivation**: Game pool PDAs derived using seeds `[b"game_pool", game_id.to_le_bytes()]`
- **On-chain game ID tracking**: Each game gets a unique on-chain ID (bigint timestamp) stored in `onChainGameId` field
- **Transaction verification**: Backend verifies player wager transactions before registering them in the game
- **Payout execution**: When authority key is configured, payouts are executed on-chain from escrow PDA

### New Schema Fields
- `Game.onChainGameId`: On-chain game ID (bigint as string)
- `Game.escrowPDA`: Game pool PDA address for escrow
- `Game.winnerPayoutTxSig`: Transaction signature for winner payout
- `Game.treasuryFeeTxSig`: Transaction signature for treasury fee
- `Player.txSignature`: Wager transfer transaction signature

### New API Endpoints
- `POST /api/games/prepare` - Get escrow PDA before SOL transfer (returns gameId, escrowPDA, onChainGameId)
- Updated `POST /api/games/join` - Now accepts gameId from prepare step and txSignature

### Environment Variables
- `SOLANA_AUTHORITY_PRIVATE_KEY` (optional) - Base58-encoded private key for on-chain payout execution

## Recent Changes (2026-01-25)

### WAGA Reward System Overhaul
- **Tier-based WAGA entry rewards**: Rewards now scale based on wager tier:
  - 0.01 SOL: 100% of USD value in WAGA
  - 0.1 SOL: 75% of USD value in WAGA
  - 1 SOL: 65% of USD value in WAGA
  - 10 SOL: 50% of USD value in WAGA
- **Winner WAGA rewards**: Winner receives 100% USD value match of their SOL winnings in WAGA
- **Price feed integration**: Real-time SOL/USD prices via CoinGecko API
- **Mock WAGA price**: Using $0.001/WAGA for testing (will integrate Raydium DEX price once live)

### Payout Structure
- Winner receives exactly 90% of the total pool
- 10% goes to foundation treasury (BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP)

### Timer Synchronization
- Countdown timers use server-provided `countdownEndsAt` and `roundEndsAt` timestamps
- Server includes `serverTime` in game API responses for client clock synchronization
- CountdownTimer component calculates clock offset between server and client time
- All clients display the same countdown regardless of local clock differences

### Header/Navbar Updates
- Mobile: Logo on left (spanning both rows), Connect button and sandwich menu on top-right, price widget on bottom-right
- Desktop: Logo acts as home button, Play and Leaderboard nav links, price widget, wallet dropdown
- Price widget shows SOL/WAGA prices with official logos (always-visible switch arrows)
- Connect button shortened to "Connect" for mobile

### WAGA Token Vesting System
- **Winner rewards go to vesting**, NOT immediately to wallet
- Total WAGA vesting is tracked in player profile (`wagaVestingTotal`, `wagaVestingClaimed`)
- **10% daily release**: Every 24 hours, players can claim 10% of their total vesting amount
- Profile page shows vesting progress bar, remaining balance, and claim button
- This prevents market dumping by gradual token release
- Entry rewards (from joining games) are still immediate

### WAGA Reward Flow
1. **Entry Reward**: Player joins game -> WAGA minted immediately to their profile based on tier (100%/75%/65%/50% of USD value)
2. **Winner Reward**: Game completes -> Winner's 100% USD match of SOL winnings goes to vesting pool
3. **Daily Claim**: Winner can claim 10% of vesting per 24 hours on Profile page

### Key API Endpoints
- `GET /api/profile/:walletAddress/vesting` - Get vesting status
- `POST /api/profile/:walletAddress/claim-vesting` - Claim available vested WAGA

## Changes (2026-01-20)

### Game System Updates
- **Removed mock players**: Games now require real wallet connections only - no auto-fill bots
- **Wallet validation**: Backend validates Solana wallet addresses (32-44 character base58)
- **WAGA balance display**: Wallet dropdown shows WAGA token balance synced from player profile
- **Success notifications**: Toast messages show WAGA rewards earned when joining games
- **Players needed indicator**: Live game cards show how many more players are needed

### Solana Programs & Wallets (Devnet)
- MyLuckySol Program: `Hiu3MhgaUWZS38pugERhxrjH4J3dJ1qcbzbtgXScBpd5`
- WAGA Token Mint: `9XU2yJhhAJ1FoUZXbMchZvQMLHui2LQ2a4HC6vaer3JV`
- WAGA Rewards Vault: `9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf` (authority wallet)
- WAGA Vault ATA: `66bMApCZTRGqfxAXBML6dPAEJX1VwAsBR1DrfwsLaJr1` (holds 1B WAGA for rewards)
- Foundation Treasury: `BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP` (receives 10% house fee)

### On-Chain Transaction Flow
1. Player joins game -> Signs SOL transfer to treasury wallet
2. Transaction confirms on Solana devnet
3. Backend registers player in game after tx confirmation
4. When game ends: 90% to winner(s), 10% stays in treasury

### Architecture Notes
- Backend validates joins and tracks WAGA rewards in player profiles
- Games start automatically when all player slots are filled (no bots)
- On-chain SOL transfers enabled via Buffer polyfill for browser compatibility
- Network: Running on Devnet

### Key Files
- `server/routes.ts`: API endpoints, wallet validation, WAGA reward calculations
- `server/storage.ts`: Game state management, tier-based WAGA reward distribution
- `server/price-service.ts`: SOL/USD price feed, WAGA value calculations
- `shared/schema.ts`: WAGA_ENTRY_REWARD_PERCENT, WAGA_WINNER_REWARD_PERCENT constants
- `client/src/pages/Play.tsx`: On-chain SOL transfers with wallet signing
- `client/src/components/WagerSelector.tsx`: Displays tier-based reward percentages
- `client/src/lib/wallet-context.tsx`: Syncs WAGA balance from profile
- `client/src/lib/polyfills.ts`: Buffer polyfill for browser Solana compatibility
- `shared/constants.ts`: Treasury wallet address and payout split constants

### Minting WAGA Tokens
To mint WAGA tokens for testing, run:
```bash
anchor run mint-waga
```
This will initialize the token (if not already done) and mint 1000 WAGA to your deployment wallet.
