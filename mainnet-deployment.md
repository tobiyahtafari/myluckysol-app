# Mainnet Deployment Checklist & Risk Assessment - MyLuckySol

## 1. High Priority Risks (Status: Audited)

### [CRITICAL] Hot Wallet Exposure (Fallback Mode)
- **Risk**: The server holds the `SOLANA_AUTHORITY_PRIVATE_KEY`. In "Fallback Mode", this wallet holds all player wagers and payouts.
- **Mitigation**: 
  1. **Primary**: Deploy the Anchor program (Section 4) to move funds into on-chain PDAs.
  2. **Secondary**: Limit the Authority wallet balance to the minimum required for active games.
  3. **Operational**: Use a fresh keypair for mainnet and store it ONLY in Replit Secrets.

### [CRITICAL] Database Persistence & Replay Protection
- **Status**: **FIXED** (Verified `PgStorage` and `markTransactionUsed` implementation).
- **Risk**: Using `MemStorage` would lose all player data and allow transaction replays after restart.
- **Requirement**: `DATABASE_URL` **must** be set in production to enable `PgStorage`.

### [HIGH] Non-Atomic Payouts
- **Status**: **MITIGATED** in Fallback, **FIXED** in On-Chain.
- **Details**: In Fallback mode, the server sends 3 separate transactions. If one fails, the others might still succeed.
- **Fix**: The Anchor program's `finalize_game` instruction (On-Chain mode) handles all payouts in a single atomic transaction.

### [HIGH] Rate Limiting
- **Status**: **FIXED**.
- **Details**: `express-rate-limit` is active on `/api/games/join`, `/api/chat`, and `/api/profile/:w/claim-vesting`.

## 2. Deployment Instructions: Replit vs. Local

### Deploying from Replit (Web Server & DB)
**You should deploy the Web App directly from Replit.**
- **Frontend/Backend**: Replit handles hosting, SSL, and scaling.
- **Database**: Use the Replit PostgreSQL integration.
- **Secrets**: Store all keys in the "Secrets" tab.

### Deploying from Local Device (Smart Contract)
**You MUST use a local device for the Anchor Program deployment.**
- **Reason**: Replit does not support the Rust/Anchor BPF build toolchain required to compile and deploy Solana programs.
- **Action**: 
  1. Download the `program/` folder to your local machine.
  2. Install Solana CLI and Anchor.
  3. Run `anchor build` and `anchor deploy --provider.cluster mainnet`.
  4. Update `shared/constants.ts` with the new Program ID.

## 3. Final Mainnet Environment Variables
```env
NODE_ENV=production
SOLANA_NETWORK=mainnet
SOLANA_RPC_URL=https://your-private-rpc-endpoint
SOLANA_AUTHORITY_PRIVATE_KEY=your_base58_private_key
DATABASE_URL=postgres://... (From Replit DB)
REQUIRE_ONCHAIN_WAGA=true
SESSION_SECRET=long_random_string
```

## 4. Summary Checklist
- [ ] Database migrated to PostgreSQL (`PgStorage` active)
- [ ] Anchor program deployed via local device
- [ ] WAGA Rewards Vault funded on mainnet
- [ ] Private RPC URL configured (Do not use public nodes)
- [ ] All Replit Secrets populated
