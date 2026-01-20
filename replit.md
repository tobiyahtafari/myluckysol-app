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
1. **1v1 Mode**: 2 players, 1 round, 120s timer
2. **2-Round Mode**: 4 players, 2 rounds, 150s timer
3. **3-Round Mode**: 8 players, 3 rounds, 150s timer
4. **4-Round Mode**: 16 players, 4 rounds, 150s timer

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
- `POST /api/games/join` - Join or create a game
- `GET /api/games/:id` - Get game by ID
- `GET /api/profile/:walletAddress` - Get player profile
- `GET /api/profile/:walletAddress/history` - Get game history
- `GET /api/leaderboard` - Get leaderboard

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

## Recent Changes (2026-01-20)

### Game System Updates
- **Removed mock players**: Games now require real wallet connections only - no auto-fill bots
- **Wallet validation**: Backend validates Solana wallet addresses (32-44 character base58)
- **WAGA rewards on entry**: Players automatically receive 10x their wager in WAGA tokens when joining a game
- **WAGA rewards on win**: Winners receive 100x their winnings in WAGA tokens
- **WAGA balance display**: Wallet dropdown shows WAGA token balance synced from player profile
- **Success notifications**: Toast messages show WAGA rewards earned when joining games
- **Players needed indicator**: Live game cards show how many more players are needed

### Solana Programs (Devnet)
- MyLuckySol: `Hiu3MhgaUWZS38pugERhxrjH4J3dJ1qcbzbtgXScBpd5`
- WAGA Token: `9NWksMKpEd9brW31BU6eZKvbUykRuCZgtbYBpcT6oeho`

### Architecture Notes
- Backend validates joins and tracks WAGA rewards in player profiles
- Games start automatically when all player slots are filled (no bots)
- On-chain SOL transfers pending integration (currently backend-tracked)
- Network: Running on Devnet with 11 SOL in deployment wallet

### Files Modified
- `server/routes.ts`: Removed mock player logic, added wallet validation, returns WAGA rewards
- `server/storage.ts`: Updated joinGame to distribute WAGA entry rewards
- `server/waga-service.ts`: New service for WAGA token distribution tracking
- `client/src/pages/Play.tsx`: Updated to use wallet modal, show rewards in toasts
- `client/src/lib/wallet-context.tsx`: Syncs WAGA balance from profile

### Minting WAGA Tokens
To mint WAGA tokens for testing, run:
```bash
anchor run mint-waga
```
This will initialize the token (if not already done) and mint 1000 WAGA to your deployment wallet.
