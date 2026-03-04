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

#### 2.1 Local/WSL Setup Prerequisites
1. **Install Solana CLI**:
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"
   ```
2. **Install Rust**:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
3. **Install Anchor**:
   ```bash
   avm install latest
   avm use latest
   ```

#### 2.2 Deployment Steps (Local/WSL)
1. **Download Program**: Download the `program/` folder from Replit to your local WSL environment.
2. **Configure Solana CLI**:
   ```bash
   solana config set --url mainnet-beta
   # Ensure your local keypair has ~2-3 SOL for deployment fees
   solana config set --keypair ~/.config/solana/id.json
   ```
3. **Build & Deploy**:
   ```bash
   cd program
   anchor build
   # Note the Program ID from the output or target/deploy/
   anchor deploy --provider.cluster mainnet
   ```
4. **Update Replit**:
   - Update `shared/constants.ts` with the new **Program ID**.
   - Set the Program ID in Replit Secrets if applicable.
   - Run any one-time initialization instructions (e.g., `initialize-config`) if present in the Anchor project.

## 3. WAGA Token Setup (Mainnet)

**Official WAGA Token Address**: `He6oGbz2KLH1G1V1PVbCZWHru8rWiWR6UZUxX6z9um5F`

1. **Update Constants**: Ensure `WAGA_TOKEN_MINT` in `shared/constants.ts` is `He6oGbz2KLH1G1V1PVbCZWHru8rWiWR6UZUxX6z9um5F`.
2. **Vault Funding**: Create a fresh wallet for the **WAGA Rewards Vault**. Deposit WAGA tokens into this wallet's Associated Token Account (ATA).
3. **Authority Delegation**: Ensure the Authority wallet (`SOLANA_AUTHORITY_PRIVATE_KEY`) is authorized to sign for the Vault ATA (via ownership or delegation).

## 4. Final Mainnet Environment Variables
```env
NODE_ENV=production
SOLANA_NETWORK=mainnet
SOLANA_RPC_URL=https://your-private-rpc-endpoint
SOLANA_AUTHORITY_PRIVATE_KEY=your_base58_private_key
DATABASE_URL=postgres://... (From Replit DB)
REQUIRE_ONCHAIN_WAGA=true
SESSION_SECRET=long_random_string
```

## 5. Summary Checklist
- [ ] Database migrated to PostgreSQL (`PgStorage` active)
- [ ] Anchor program deployed via local device (WSL)
- [ ] WAGA Rewards Vault funded on mainnet
- [ ] Private RPC URL configured (Do not use public nodes)
- [ ] All Replit Secrets populated
- [ ] WAGA Mint address verified as `He6oGbz2KLH1G1V1PVbCZWHru8rWiWR6UZUxX6z9um5F`
