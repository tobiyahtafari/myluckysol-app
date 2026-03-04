# MyLuckySol — Mainnet Deployment Guide

## Table of Contents
1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Wallet Architecture](#2-wallet-architecture)
3. [Environment Variables](#3-environment-variables)
4. [Anchor Program Deployment](#4-anchor-program-deployment)
5. [WAGA Token Setup](#5-waga-token-setup)
6. [Escrow Account & Payout Flow](#6-escrow-account--payout-flow)
7. [WAGA Rewards Vault](#7-waga-rewards-vault)
8. [Vesting System](#8-vesting-system)
9. [Referral Rewards](#9-referral-rewards)
10. [Persistent Database Migration](#10-persistent-database-migration)
11. [Rate Limiting & Security](#11-rate-limiting--security)
12. [Security Fixes Applied (This Session)](#12-security-fixes-applied-this-session)
13. [Known Remaining Risks](#13-known-remaining-risks)
14. [Go-Live Steps](#14-go-live-steps)

---

## 1. Pre-Deployment Checklist

Before any mainnet transaction, confirm each item is complete:

- [ ] Anchor program compiled and audited
- [ ] Anchor program deployed to **mainnet-beta** with a new program ID
- [ ] `shared/constants.ts` updated with mainnet program ID, token mint, and wallet ATAs
- [ ] WAGA Rewards Vault ATA funded with enough WAGA for projected rewards
- [ ] All 4 wallet keypairs are secured (hardware wallet or multi-sig recommended for Treasury and Giveaway)
- [ ] `SOLANA_NETWORK=mainnet` environment variable set
- [ ] `SOLANA_RPC_URL` pointed to a private RPC endpoint (Helius, QuickNode, Triton, etc.)
- [ ] `REQUIRE_ONCHAIN_WAGA=true` environment variable set
- [ ] Persistent database connected (PostgreSQL — see section 10)
- [ ] Rate limiting middleware enabled (see section 11)
- [ ] HTTPS enforced on all endpoints
- [ ] Admin moderation interface secured

---

## 2. Wallet Architecture

The platform uses **four distinct wallets**. Each has a unique role and should be kept completely separate for security and accounting.

### 2.1 Authority / Escrow Wallet

**Current (devnet):** `9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf`

**Purpose:**
- Holds the private key loaded as `SOLANA_AUTHORITY_PRIVATE_KEY`
- Acts as the game escrow in fallback mode (before Anchor program is deployed)
- Once the Anchor program is deployed, the escrow role moves entirely to the on-chain program PDAs — the authority wallet then acts only as the **transaction fee payer and WAGA transfer signer**
- Signs all WAGA token transfers from the rewards vault

**Funding required:**
- Keep a minimum of **5 SOL** for transaction fees at all times
- Set up monitoring alerts if balance falls below 2 SOL

**Security:**
- Store the private key as a Replit Secret (`SOLANA_AUTHORITY_PRIVATE_KEY`)
- For mainnet: generate a brand new keypair using `solana-keygen new`
- Never share the private key; never expose it in logs or responses
- Consider a hardware wallet for the authority keypair in production

---

### 2.2 Foundation Treasury Wallet

**Address:** `BmC897s2wDqPdNR1zvsAMZqsZfsm7KprU6DUDLYgjdKP`

**Purpose:**
- Receives the **9% platform fee** from every game pool
- Receives the username update SOL fee (priced in USD, paid in SOL)

**Inbound transfers:**
- Paid by the Anchor program's `finalize_game` instruction on-chain
- In fallback mode: paid by the authority wallet after game resolution

**Security:**
- This is a receive-only wallet for SOL income
- Use a hardware wallet (Ledger) or a multisig (Squads Protocol) for this address
- Never load its private key into the server

---

### 2.3 Giveaway Wallet

**Address:** `FGY64g3Pt8wMrMR3A9abkVxSjwh2Yt4dT4BYkw6rU3yf`

**Purpose:**
- Receives the **1% giveaway contribution** from every game pool
- Holds the jackpot until the 1,000,000-game milestone is reached
- Pays out to the top-10 luck and top-10 streak winners at milestone

**Payout breakdown at each milestone (20 total recipients):**

| Rank | Luck Prize | Streak Prize |
|------|-----------|-------------|
| 1st  | 22%       | 22%         |
| 2nd  | 16%       | 16%         |
| 3rd  | 12%       | 12%         |
| 4th  | 10%       | 10%         |
| 5th  | 9%        | 9%          |
| 6th  | 8%        | 8%          |
| 7th  | 7%        | 7%          |
| 8th  | 6%        | 6%          |
| 9th  | 5%        | 5%          |
| 10th | 5%        | 5%          |

The total jackpot is always displayed as `max(200 SOL, actual balance)`. The displayed floor of 200 SOL is purely cosmetic — the actual payout is the real accumulated balance.

**Security:**
- Use a hardware wallet or multisig for the giveaway address
- Payout transactions at milestone must be manually triggered and signed by the giveaway wallet owner
- Never auto-sign giveaway payouts from a hot server wallet

---

### 2.4 WAGA Rewards Vault

**Current (devnet):** `9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf` (same as authority — devnet only)

**Mainnet:** Create a **dedicated separate wallet** for the WAGA vault. Fund its Associated Token Account (ATA) with the WAGA token.

**Purpose:**
- Holds all WAGA tokens that are distributed as rewards
- Signs transfers via the authority keypair (the vault's ATA must be co-owned or delegated to the authority)

**Update in `shared/constants.ts` before mainnet:**
```typescript
export const WAGA_REWARDS_VAULT = "<mainnet_vault_wallet_address>";
export const WAGA_VAULT_ATA    = "<mainnet_vault_ATA_address>";
```

---

## 3. Environment Variables

Set all of the following as Replit Secrets before going live on mainnet.

| Variable | Description | Required |
|----------|-------------|----------|
| `SOLANA_AUTHORITY_PRIVATE_KEY` | Base58 private key of the authority/escrow wallet | **YES** |
| `SOLANA_NETWORK` | Set to `mainnet` | **YES** |
| `SOLANA_RPC_URL` | Private RPC URL (Helius, QuickNode, etc.) | **YES** |
| `REQUIRE_ONCHAIN_WAGA` | Set to `true` — blocks vesting claims if WAGA transfer fails | **YES** |
| `SESSION_SECRET` | Strong random string for session management | **YES** |
| `DATABASE_URL` | PostgreSQL connection string | **YES** (see section 10) |

### Recommended private RPC providers
- **Helius** (`https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`) — best reliability
- **QuickNode** — low latency
- **Triton** — high throughput

Do **not** use `https://api.mainnet-beta.solana.com` for production — it is rate-limited and unreliable under load.

---

## 4. Anchor Program Deployment

The Solana smart contract (Anchor program) handles on-chain escrow, wager collection, and payout distribution. In the current build the program is **not yet deployed**, so the platform runs in fallback mode (direct SOL transfers to the authority wallet).

### Steps to deploy the Anchor program

```bash
# 1. Switch Solana CLI to mainnet
solana config set --url mainnet-beta

# 2. Set the paying keypair (must have SOL for deployment fees)
solana config set --keypair ~/.config/solana/id.json

# 3. Build the program
anchor build

# 4. Deploy the program
anchor deploy --program-name myluckysol_program

# 5. Copy the new Program ID output and update shared/constants.ts
# MYLUCKYSOL_PROGRAM_ID = "<new_mainnet_program_id>"

# 6. Initialize the game config PDA on-chain (one-time setup)
anchor run initialize-config
```

After deployment, set the env var so the platform auto-switches:
```
SOLANA_NETWORK=mainnet
```

The server's `isProgramDeployed()` check will detect the live program and switch from fallback mode automatically on next restart.

### Program PDA Architecture

| PDA | Seeds | Role |
|-----|-------|------|
| Game Config | `["game_config"]` | Global authority config, initialized once |
| Game State | `["game", game_id_u64_le]` | Tracks game state on-chain |
| Game Pool | `["game_pool", game_id_u64_le]` | Escrow account that holds all player wagers |

---

## 5. WAGA Token Setup

### 5.1 Deposit WAGA to Rewards Vault

Since the WAGA token is already deployed and minted on mainnet, you only need to fund the Rewards Vault's Associated Token Account (ATA) so the platform can distribute rewards.

1. **Identify your Mainnet WAGA Mint:**
   Ensure `WAGA_TOKEN_MINT` in `shared/constants.ts` matches your existing mainnet token.

2. **Create/Identify the Rewards Vault ATA:**
   If not already created, create an ATA for the `WAGA_REWARDS_VAULT` wallet:
   ```bash
   spl-token create-account <WAGA_TOKEN_MINT> --owner <WAGA_REWARDS_VAULT_ADDRESS>
   ```

3. **Deposit WAGA Tokens:**
   Transfer the required amount of WAGA tokens from your holding wallet to the Vault ATA. This balance will be used for:
   - **Wager Bonuses:** Immediate 100x match.
   - **Winnings Match:** 1000x match (into vesting).
   - **Referral Rewards:** 100 WAGA for both parties.

4. **Update Constants:**
   Ensure `WAGA_REWARDS_VAULT` and `WAGA_VAULT_ATA` in `shared/constants.ts` are correct.

### 5.2 Reward Supply Planning

Calculate the WAGA supply needed for the vault:

| Event | WAGA Per Event | Notes |
|-------|----------------|-------|
| Game entry | `wager_SOL × 100` per player | Immediate transfer |
| Win bonus | `won_SOL × 1000` | Goes into vesting, released 10% per day |
| Referral (each party) | 100 WAGA | Immediate transfer on username set |
| God Streak natural breaker | `winBonus × 5` | 5x multiplier on vested win bonus |
| God Streak triggered breaker | `winBonus × 3` | 3x multiplier on vested win bonus |

**Example for 1,000 games at 0.1 SOL wager:**
- Entry rewards: 1,000 games × 2 players × (0.1 × 100) = 20,000 WAGA
- Win rewards (vested): 1,000 × (0.09 SOL × 1000) = 90,000 WAGA
- Minimum vault size: 200,000+ WAGA recommended to start

---

## 6. Escrow Account & Payout Flow

### 6.1 On-Chain Mode (Post-Program Deployment)

When the Anchor program is deployed, every game follows this exact flow:

```
Player A sends 0.1 SOL ──► join_game instruction ──► Game Pool PDA
Player B sends 0.1 SOL ──► join_game instruction ──► Game Pool PDA

                        Game Pool PDA holds 0.2 SOL

Game resolves (HMAC-SHA256 provably fair selection)
                        ▼
finalize_game instruction distributes:
  ├── 0.18 SOL (90%) ──────────────────────────────► Winner wallet
  ├── 0.018 SOL (9%) ──────────────────────────────► Foundation Treasury
  └── 0.002 SOL (1%) ──────────────────────────────► Giveaway Wallet
```

The `finalize_game` instruction is signed by the authority keypair server-side. All three transfers are atomic — they either all succeed or all fail.

### 6.2 Fallback Mode (Current / Pre-Deployment)

While the program is not yet deployed, the platform uses direct SOL transfers:

```
Player sends wager ──► Authority wallet (escrow)
Game resolves
Authority wallet sends:
  ├── 90% ──► Winner
  ├── 9%  ──► Treasury
  └── 1%  ──► Giveaway
```

All transfers are verified on-chain via `validateTransfer()` before a player is accepted into the game. Players cannot join without a confirmed transaction signature.

### 6.3 Ensuring No Funds Are Stuck

- If the payout transfer fails (network error), the game is flagged in storage and an alert must be raised
- Implement a recovery admin endpoint (protected with a strong admin secret header) to retry failed payouts
- Monitor the authority wallet balance and alert if it drops below the maximum possible payout for a single game

---

## 7. WAGA Rewards Vault

The WAGA vault issues three types of transfers — all signed by the authority keypair:

### 7.1 Entry Rewards (Immediate)
Sent when a player joins a game:
```
entry_waga = wager_SOL × 100
WAGA_VAULT_ATA ──► player_ATA (immediately)
```

### 7.2 Win Rewards (Vested)
Added to the player's `wagaVestingTotal` in the database. NOT immediately transferred. The server tracks:
- `wagaVestingTotal` — total WAGA owed
- `wagaVestingClaimed` — amount already paid out
- `wagaVestingLastClaim` — timestamp of last withdrawal

Player can claim 10% of their remaining vested balance once every 24 hours:
```
claimable = floor(remaining × 0.10)
WAGA_VAULT_ATA ──► player_ATA (after on-chain transfer confirmed)
storage.commitVestedClaim() updates the database
```

With `REQUIRE_ONCHAIN_WAGA=true` (mandatory on mainnet), if the on-chain transfer fails, the storage record is NOT updated and the player may retry freely. This prevents any phantom credits.

### 7.3 Referral Rewards (Immediate)
Sent when a referred user sets their username:
```
WAGA_VAULT_ATA ──► referred_user_ATA (100 WAGA)
WAGA_VAULT_ATA ──► referrer_ATA (100 WAGA)
```
If either transfer fails, the rewards are rolled back in storage and an error is returned. The referred user can retry the username set.

---

## 8. Vesting System

### Security Model

The vesting system is designed so that neither the user nor the server can manipulate balances unilaterally:

1. **Server computes** `claimAmount = ceil(remaining × 10%)` in a preview step
2. **Server attempts** the on-chain WAGA transfer BEFORE writing to storage
3. **Only on confirmed transfer** does the server update `wagaVestingClaimed` and `wagaVestingLastClaim`
4. If the transfer fails, storage is unchanged — the player cannot lose their unclaimed balance

### Anti-Abuse

- 24-hour enforced cooldown between claims (enforced server-side, verified against `wagaVestingLastClaim`)
- Exponential decay: each day's claim is 10% of the remaining balance, not the original total. A 1,000 WAGA vest releases 100 on day 1, 90 on day 2, 81 on day 3, etc.
- No minimum balance required to claim — very small balances will release at least 1 WAGA due to `Math.ceil`

---

## 9. Referral Rewards

### Flow

1. User B visits site with `?ref=UserA` in URL
2. User B connects wallet — `referredBy: "UserA"` is stored as `pendingReferralBy`
3. User B sets a username (pays the SOL fee)
4. On successful username payment:
   - 100 WAGA transferred to User B
   - 100 WAGA transferred to User A
   - `referralRewarded: true` set on User B's profile
   - `referralCount` incremented on User A's profile

### Security Controls

- Self-referrals are blocked: `if (referrer.walletAddress === walletAddress)` returns 400
- Referral is only granted **once per user** (`referralRewarded: true` prevents double rewards)
- Referral rewards only trigger after the username SOL fee is confirmed on-chain (verifies payment first)
- If the WAGA transfer to User B fails, the referral is rolled back in storage (User A's reward is attempted but not rolled back in the current code — see Known Remaining Risks)

---

## 10. Persistent Database Migration

**CRITICAL: The current build uses in-memory storage (`MemStorage`). All user profiles, game history, leaderboard data, and WAGA vesting records are lost on every server restart. This MUST be replaced before mainnet launch.**

### Recommended: PostgreSQL via Replit Database

1. Enable a Replit PostgreSQL database from the Database tab
2. Copy the `DATABASE_URL` secret that Replit provides
3. Replace `MemStorage` in `server/storage.ts` with a `PgStorage` class using `drizzle-orm`
4. Run database migrations before deploying

### Minimum tables required

| Table | Stores |
|-------|--------|
| `player_profiles` | All wallet profiles, WAGA balances, vesting state |
| `games` | All game records (active and completed) |
| `game_history` | Per-wallet game result history for leaderboard |
| `global_chat_messages` | Global chat history |
| `giveaway_stats` | Jackpot state, season counter |
| `giveaway_winners` | Historical winners per season |

### Migration command (after setting up Drizzle schema)
```bash
npm run db:push
```

---

## 11. Rate Limiting & Security

### Rate Limiting (Must Add Before Mainnet)

Add `express-rate-limit` to protect against abuse and DoS:

```typescript
import rateLimit from "express-rate-limit";

// General API limit
app.use("/api/", rateLimit({ windowMs: 60_000, max: 100 }));

// Stricter limit on game join (prevents slot-camping)
app.use("/api/games/join", rateLimit({ windowMs: 60_000, max: 10 }));

// Stricter limit on vesting claims
app.use("/api/profile/:walletAddress/claim-vesting", rateLimit({ windowMs: 60_000, max: 3 }));

// Chat rate limiting
app.use("/api/chat", rateLimit({ windowMs: 10_000, max: 5 }));
```

Install the package:
```bash
npm install express-rate-limit
```

### CORS

Restrict CORS to your production domain only:
```typescript
app.use(cors({ origin: "https://myluckysol.replit.app", credentials: true }));
```

### Input Validation

All game join and profile endpoints use Zod schema validation. Do not remove these validations.

### Transaction Replay Prevention

Each `txSignature` is currently not stored after verification. For mainnet, store used transaction signatures in a `used_transactions` table and reject any duplicate signature. This prevents a player from submitting the same on-chain payment twice.

---

## 12. Security Fixes Applied (This Session)

The following vulnerabilities were identified and patched before this deployment guide was written:

### Fix 1: Privilege Escalation via Raw Request Body (Critical)

**File:** `server/routes.ts` — `PATCH /api/profile/:walletAddress`

**Problem:** The route previously passed `req.body` directly to `storage.updateProfile()`, allowing any user to set arbitrary profile fields — including `isBanned: false`, `wagaEarned: 9999999`, `godStreakActive: true`, etc.

**Fix:** The fallback branch now only allows a whitelist of safe user-controlled fields (`displayName`). All sensitive fields are set exclusively through dedicated, validated server-side logic.

### Fix 2: PAYOUT_SPLIT Constant Mismatch

**File:** `shared/constants.ts`

**Problem:** `PAYOUT_SPLIT.TREASURY_PERCENT` was set to `10`, not `9`. The 1% giveaway contribution was missing from the constant (though the actual payout logic in storage.ts used the correct schema constants).

**Fix:** Updated to `TREASURY_PERCENT: 9, GIVEAWAY_PERCENT: 1` and added `GIVEAWAY_WALLET` constant.

### Fix 3: Hardcoded Network Name

**Files:** `server/routes.ts`, `server/solana-client.ts`

**Problem:** The strings `"devnet"` and `"https://api.devnet.solana.com"` were hardcoded, making mainnet switching manual and error-prone.

**Fix:** Both now read `process.env.SOLANA_NETWORK` and `process.env.SOLANA_RPC_URL`. Setting `SOLANA_NETWORK=mainnet` switches the entire stack.

---

## 13. Known Remaining Risks

These issues were identified and must be addressed before or shortly after mainnet launch:

### High Priority

| Risk | Impact | Fix |
|------|--------|-----|
| In-memory storage | All data lost on restart, including vesting balances and game records | Replace `MemStorage` with PostgreSQL (section 10) |
| No transaction replay protection | A player could submit the same `txSignature` to join two different games | Store used signatures in DB and reject duplicates |
| No rate limiting | Endpoints can be hammered; chat spam, slot-camping | Add `express-rate-limit` (section 11) |
| Giveaway payout is not automated | At 1M games, the `triggerGiveawayPayout()` function records winners but does not send SOL | Implement a giveaway payout admin endpoint that sends SOL from the giveaway wallet to each winner |
| Referral partial rollback | If WAGA transfer to referred user fails, both are rolled back; if referrer transfer fails, only the referrer is rolled back (referred user keeps their 100 WAGA) | Add atomic rollback for both parties |

### Medium Priority

| Risk | Impact | Fix |
|------|--------|-----|
| `programDeployed` is cached at startup | If program is deployed after server start, the server stays in fallback mode until restarted | Clear the cache periodically or add a manual override endpoint |
| `PATCH /api/profile` allows `pendingReferralBy` to be overwritten | A user could in theory change their referrer before earning rewards | Validate that `pendingReferralBy` cannot be changed once set if `referralRewarded` is true |
| No CORS restriction | Any origin can make API calls | Restrict CORS to production domain |
| Public avatar endpoint | `/api/avatar/:walletAddress` has no size or type limit beyond the 2MB buffer check | Already capped at 2MB; ensure content-type validation is enforced |

### Low Priority

| Risk | Impact | Fix |
|------|--------|-----|
| Console logs expose wallet address prefixes | Not exploitable but is noisy | Sanitize logging in production |
| God streak camping expiry relies on client calling the API | If player never loads the page, streak never expires | Add a server-side cron job to run `checkAndExpireGodStreak` for all active god streak holders every hour |

---

## 14. Go-Live Steps

Follow these steps in order on launch day:

1. **Merge and deploy** the latest codebase to Replit production
2. **Set all Secrets** listed in section 3
3. **Run database migration** (`npm run db:push`) to create all tables
4. **Fund the authority wallet** with at least 5 SOL on mainnet
5. **Deposit WAGA tokens** into the Rewards Vault ATA for projected rewards
6. **Deploy the Anchor program** to mainnet (section 4)
7. **Update `shared/constants.ts`** with mainnet program ID, WAGA mint, and vault ATA
8. **Initialize the game config PDA** (one-time on-chain transaction)
9. **Smoke test** with a small real wager to verify the full game flow end-to-end
10. **Monitor** the authority wallet balance, WAGA vault balance, and server logs in real time
11. **Enable rate limiting** middleware before announcing public launch

---

*Generated: March 4, 2026 — MyLuckySol Pre-Mainnet Audit*
