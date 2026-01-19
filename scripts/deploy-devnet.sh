#!/bin/bash

set -e

echo "=== MyLuckySol Devnet Deployment Script ==="
echo ""

if ! command -v solana &> /dev/null; then
    echo "Solana CLI not found. Installing..."
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

if ! command -v anchor &> /dev/null; then
    echo "Anchor CLI not found. Please install Anchor first."
    echo "Run: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    echo "Then: avm install 0.30.1 && avm use 0.30.1"
    exit 1
fi

echo "Configuring Solana for devnet..."
solana config set --url devnet

if [ ! -f ~/.config/solana/myluckysol-keypair.json ]; then
    echo "Generating new keypair for deployment..."
    solana-keygen new --outfile ~/.config/solana/myluckysol-keypair.json --no-bip39-passphrase
fi

solana config set --keypair ~/.config/solana/myluckysol-keypair.json

WALLET_ADDRESS=$(solana address)
echo "Wallet address: $WALLET_ADDRESS"

BALANCE=$(solana balance | awk '{print $1}')
echo "Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2" | bc -l) )); then
    echo "Requesting airdrop..."
    solana airdrop 2
    sleep 5
    echo "New balance: $(solana balance)"
fi

echo ""
echo "Building programs..."
# Use Replit's native build environment for Solana/Anchor
# The build-sbf command is part of the solana-sdk which is usually in the path
# or can be invoked via anchor build if the toolchain is correct.
# Since we have anchor 0.30.0 installed via nix, we'll try a clean build.
anchor build -- -p myluckysol
anchor build -- -p waga_token


MYLUCKYSOL_PROGRAM_ID=$(solana address -k target/deploy/myluckysol-keypair.json 2>/dev/null || echo "")
WAGA_TOKEN_PROGRAM_ID=$(solana address -k target/deploy/waga_token-keypair.json 2>/dev/null || echo "")

if [ -n "$MYLUCKYSOL_PROGRAM_ID" ]; then
    echo "MyLuckySol Program ID: $MYLUCKYSOL_PROGRAM_ID"
    sed -i "s/11111111111111111111111111111111/$MYLUCKYSOL_PROGRAM_ID/g" programs/myluckysol/src/lib.rs
    sed -i "s/myluckysol = \"11111111111111111111111111111111\"/myluckysol = \"$MYLUCKYSOL_PROGRAM_ID\"/g" Anchor.toml
fi

if [ -n "$WAGA_TOKEN_PROGRAM_ID" ]; then
    echo "WAGA Token Program ID: $WAGA_TOKEN_PROGRAM_ID"
    sed -i "s/11111111111111111111111111111112/$WAGA_TOKEN_PROGRAM_ID/g" programs/waga-token/src/lib.rs
    sed -i "s/waga_token = \"11111111111111111111111111111112\"/waga_token = \"$WAGA_TOKEN_PROGRAM_ID\"/g" Anchor.toml
fi

echo ""
echo "Deploying to devnet..."
anchor deploy --provider.cluster devnet

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "MyLuckySol Program ID: $MYLUCKYSOL_PROGRAM_ID"
echo "WAGA Token Program ID: $WAGA_TOKEN_PROGRAM_ID"
echo ""
echo "View on Solana Explorer:"
echo "https://explorer.solana.com/address/$MYLUCKYSOL_PROGRAM_ID?cluster=devnet"
echo "https://explorer.solana.com/address/$WAGA_TOKEN_PROGRAM_ID?cluster=devnet"
echo ""
echo "Update your frontend configuration with these program IDs!"
