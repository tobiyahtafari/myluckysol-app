# MyLuckySol - Provably Fair Solana Chance Game

## Overview
MyLuckySol is a casino-grade, provably fair decentralized application (DApp) on the Solana blockchain. It allows players to wager SOL in various chance-based game modes to win 90% of the game pool. The platform incorporates VRF (Verifiable Random Function) for transparent and fair randomness and incentivizes participation with WAGA token rewards. The project aims to provide a secure and engaging on-chain gaming experience with a clear economic model for player rewards and platform sustainability.

## User Preferences
- Dark theme only (casino aesthetic)
- No emoji usage
- Space Grotesk font family
- Framer Motion for animations

## System Architecture

### Core Technologies
- **Frontend**: React, TypeScript, Vite, TailwindCSS, Framer Motion
- **State Management**: Zustand, TanStack Query
- **Backend**: Express.js
- **Blockchain Integration**: Solana (using multi-wallet support for Phantom, OKX, Solflare, Backpack)

### Game Mechanics
- **Game Modes**: Supports 1v1, 2-round (4 players), 3-round (8 players), and 4-round (16 players) formats.
- **Wager Tiers**: Fixed SOL wager amounts (0.01, 0.1, 1, 10 SOL).
- **Payouts**: 90% of the pool goes to the winner(s), 10% to the Foundation Treasury.
- **Provably Fair System**: Utilizes Server Seed, Server Seed Hash, Client Seed (derived from player wallet addresses), and HMAC-SHA256 for verifiable random winner selection. The server seed is revealed post-game for verification.

### WAGA Token Economy
- **Entry Reward**: 100x SOL wager match (immediate transfer).
- **Win Bonus**: 1000x SOL won match (vested rewards).
- **Referral Reward**: 100 WAGA each for referrer and referred user (after referred user sets username).
- **Vesting System**: Winner rewards are subject to a vesting schedule, releasing 10% daily to prevent market dumping.

### User Interface & Experience
- **Design System**: Predominantly dark theme with gold (primary), purple (secondary), and green (accent) colors.
- **Wallet Integration**: Supports multiple Solana wallets with network switching (Devnet/Mainnet) and auto-reconnection.
- **Profile Management**: Players can set usernames (with a small SOL fee), track game history, manage referrals, and claim vested WAGA.

### Backend & Blockchain Interaction
- **API Endpoints**: Facilitate game preparation, joining, claiming winnings, profile management (including username updates and WAGA vesting), leaderboard queries, global stats (`/api/stats`), completed games feed (`/api/games/completed`), and game verification (`/api/verify`).
- **Solana Integration**: Handles SOL transfers (wagers, payouts, username fees), WAGA token transfers from a central Rewards Vault, and on-chain program interactions.
- **Fallback Mode**: Currently operates in a fallback mode using direct SOL transfers to an authority wallet due to an un-deployed Solana program. The full on-chain mode will use PDA-based escrow after program deployment.

### Pages
- **Game Notifications**: Site-wide animated pop-up notifications with sound when a new game is created. Clicking navigates to Play page with pre-selected mode/wager. Auto-dismisses after 7 seconds.
- **Home** (`/`): Hero section with real-time global stats (Games Played, SOL Won, Players, WAGA Rewarded), embedded YouTube video with play/replay overlays, feature cards, game modes, earnings calculator, how it works, and CTA.
- **Fairness** (`/fairness`): Provably fair explanation, full algorithm source code display, game verification search by Server Seed Hash, and real-time completed games feed.
- **Play** (`/play`): Game mode selection and wager picker.
- **Game Room** (`/game/:id`): Live game view with player slots, countdown timer, chat.
- **Leaderboard** (`/leaderboard`): Sortable by earnings/luck/streaks with period filters.
- **Profile** (`/profile`): Username/avatar management, game history, referral system, WAGA vesting claims.
- **Docs** (`/docs`): Contract addresses and ecosystem info (WAGA Rewards Escrow model).
- **How to Play** (`/how-to-play`): Step-by-step guide.
- **Terms** (`/terms`), **Privacy** (`/privacy`): Legal pages.

### Anti-Abuse Mechanisms
- **Referral Program Gating**: Referral rewards are activated only after a user sets a username, which incurs a small SOL fee.
- **Username Change Cooldown**: 72-hour cooldown on username changes.
- **Strict Payment Verification**: Backend validates SOL transfers for username updates to prevent abuse.

## External Dependencies
- **Solana Blockchain**: Core platform for transactions, smart contracts (program), and token (WAGA) operations.
- **Phantom, OKX Wallet, Solflare, Backpack**: Supported wallets for user interaction with the Solana blockchain.
- **CoinGecko**: Used by the `price-service.ts` for SOL/USD price feed to calculate username update costs.