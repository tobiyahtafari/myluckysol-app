# Local Solana Program Deployment Guide (Windows)

This guide provides step-by-step instructions to deploy the MyLuckySol Anchor program from your Windows machine to Solana Devnet.

## Prerequisites

### 1. Install WSL2 (Highly Recommended)
Solana and Anchor tools work best on Linux. WSL2 (Windows Subsystem for Linux) is the most stable way to run them on Windows.
1. Open PowerShell as Administrator.
2. Run: `wsl --install`
3. Restart your computer if prompted.
4. Set up your Ubuntu username and password.

### 2. Install Dependencies (Inside WSL2/Ubuntu)
Open your WSL2 terminal (Ubuntu) and run these commands:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential build tools
sudo apt install build-essential pkg-config libssl-dev libudev-dev m4 -y

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Solana CLI (v1.18.26 or newer)
sh -c "$(curl -sSfL https://release.solana.com/v1.18.26/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Install Anchor CLI (v0.30.1)
cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked --tag v0.30.1
```

## Deployment Steps

### 1. Download the Project
1. In WSL2, create a directory for the project: `mkdir ~/myluckysol && cd ~/myluckysol`
2. Download your project files from Replit (or use `git clone` if you've pushed it to GitHub).

### 2. Configure Your Wallet
1. Create a deployment keypair if you don't have one:
   ```bash
   solana-keygen new --outfile ~/deploy-keypair.json
   ```
2. Set this wallet as the default:
   ```bash
   solana config set --keypair ~/deploy-keypair.json --url devnet
   ```
3. **Important**: Transfer your test SOL from your devnet wallet to this new address:
   - Your address: `solana address`
   - Check balance: `solana balance`

### 3. Update Program ID
1. Get the current program ID from `Anchor.toml` and `programs/myluckysol/src/lib.rs`. It should be `Hiu3MhgaUWZS38pugERhxrjH4J3dJ1qcbzbtgXScBpd5`.
2. Ensure `Anchor.toml` points to devnet:
   ```toml
   [provider]
   cluster = "devnet"
   wallet = "~/deploy-keypair.json"
   ```

### 4. Build and Deploy
1. Navigate to the project root in WSL2.
2. Build the program:
   ```bash
   anchor build
   ```
3. Deploy the program:
   ```bash
   anchor deploy
   ```

## Post-Deployment
Once the program is successfully deployed:
1. Replit will automatically detect that the program is executable.
2. The DApp will switch from "Fallback Mode" to "Full On-Chain Mode".
3. Refresh your Replit preview to see the updated escrow-based game flow.

## Troubleshooting
- **Rust Version**: Ensure `rustc --version` is 1.85.0 or newer.
- **Insufficient Funds**: Deployment on devnet requires ~3 SOL. Request airdrops or transfer from another wallet: `solana airdrop 2` (note: devnet airdrops are often rate-limited).
- **WSL Pathing**: Access your Windows files from WSL at `/mnt/c/Users/...`
