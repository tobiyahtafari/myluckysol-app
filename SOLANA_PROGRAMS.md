# MyLuckySol Solana Programs

## Overview

MyLuckySol consists of two Solana programs built with Anchor:

1. **myluckysol** - Main game program handling game creation, joining, rounds, and payouts
2. **waga-token** - SPL token program for WAGA reward tokens

## Architecture

### Hybrid Approach
- **On-chain**: Payouts, wagers, VRF randomness, token rewards
- **Off-chain (Backend)**: Matchmaking, game timers, user profiles, leaderboards

### Flow
1. Backend creates game on-chain when matchmaking succeeds
2. Players join game by sending SOL wager to game pool PDA
3. Backend triggers rounds using Switchboard VRF for randomness
4. On-chain program eliminates players based on VRF results
5. Winner automatically receives 90% of pool (on-chain payout)
6. 10% goes to treasury wallet (house fee)
7. WAGA tokens minted for entry rewards and win bonuses

## Program Accounts

### Game Config (PDA)
- Authority: Admin wallet
- Treasury: Foundation wallet for house fees
- House fee BPS: 1000 (10%)
- Stats: Total games, total SOL wagered

### Game (PDA per game)
- Game ID, mode, wager amount
- Players list with active status
- Current round, max rounds
- Winner (set when game completes)

### Game Pool (PDA per game)
- Holds all player wagers
- Transfers to winner on completion

### WAGA Token
- SPL token with 9 decimals
- Mint authority is PDA (program controls minting)
- Entry reward: 10x wager in tokens
- Win bonus: 100x winnings in tokens

## Wager Tiers (in lamports)
- 0.01 SOL = 10,000,000 lamports
- 0.1 SOL = 100,000,000 lamports
- 1 SOL = 1,000,000,000 lamports
- 10 SOL = 10,000,000,000 lamports

## Game Modes
- **1v1**: 2 players, 1 round
- **2-Round**: 4 players, 2 rounds (half eliminated each round)
- **3-Round**: 8 players, 3 rounds
- **4-Round**: 16 players, 4 rounds

## Switchboard VRF Integration

Uses Switchboard Oracle for provably fair randomness:
1. Request randomness before each round
2. VRF callback provides 32-byte random seed
3. Seed deterministically selects eliminated players
4. All results verifiable on-chain

## Devnet Deployment

### Prerequisites
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.30.1
avm use 0.30.1
```

### Deploy
```bash
# Run deployment script
./scripts/deploy-devnet.sh
```

### Get Devnet SOL
```bash
solana airdrop 2
# Or use: https://faucet.solana.com
```

## Client SDK

Located in `client/src/lib/solana/`:

- `program-types.ts` - Type definitions and PDA helpers
- `game-client.ts` - Client class for interacting with programs
- `wallet-adapter.ts` - Wallet connection utilities

### Usage Example
```typescript
import { MyLuckySolClient, devnetClient } from "@/lib/solana";

// Get player balance
const balance = await devnetClient.getPlayerBalance(walletPublicKey);

// Build join game transaction
const tx = await devnetClient.buildJoinGameTransaction(gameId, walletPublicKey);

// Sign and send with wallet
const signature = await signAndSendTransaction(wallet, connection, tx);
```

## Mainnet Migration

When ready for mainnet:

1. Update program IDs in `Anchor.toml` and source files
2. Replace WAGA token mint with existing mainnet WAGA contract
3. Update RPC endpoints in client
4. Deploy with: `anchor deploy --provider.cluster mainnet-beta`
5. Verify programs on Solana Explorer

## Security Considerations

- All payouts are automatic and on-chain (no manual claiming)
- VRF ensures provably fair randomness
- PDAs control all funds (no admin key access to player funds)
- House fee calculated on-chain (cannot be manipulated)
- Game state transitions are validated
