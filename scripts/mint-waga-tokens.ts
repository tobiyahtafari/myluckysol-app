import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { mintTo, getOrCreateAssociatedTokenAccount, getMint } from "@solana/spl-token";
import bs58 from "bs58";

const WAGA_TOKEN_MINT = "9NWksMKpEd9brW31BU6eZKvbUykRuCZgtbYBpcT6oeho";
const WAGA_REWARDS_VAULT = "9hqGVjFXwBSteHmAhcQ6MpghKv4TVhtCd344NNTtWkjf";
const MAINNET_RPC = "https://mainnet.helius-rpc.com/?api-key=eefa5aa4-0358-4152-8a1d-60bacc3a2670";
const DEVNET_RPC = "https://api.devnet.solana.com";

async function mintWagaTokens() {
  const authorityPrivateKey = process.env.SOLANA_AUTHORITY_PRIVATE_KEY;
  
  if (!authorityPrivateKey) {
    console.error("Error: SOLANA_AUTHORITY_PRIVATE_KEY environment variable not set");
    process.exit(1);
  }

  try {
    const network = process.env.SOLANA_NETWORK || "mainnet";
    const rpcUrl = network === "mainnet" ? MAINNET_RPC : DEVNET_RPC;
    const connection = new Connection(rpcUrl, "confirmed");
    const authorityKeypair = Keypair.fromSecretKey(bs58.decode(authorityPrivateKey));
    
    console.log("Authority wallet:", authorityKeypair.publicKey.toBase58());
    console.log("WAGA Token Mint:", WAGA_TOKEN_MINT);
    console.log("Rewards Vault:", WAGA_REWARDS_VAULT);
    
    const mintPubkey = new PublicKey(WAGA_TOKEN_MINT);
    const vaultPubkey = new PublicKey(WAGA_REWARDS_VAULT);
    
    // Get mint info
    const mintInfo = await getMint(connection, mintPubkey);
    console.log(`Token decimals: ${mintInfo.decimals}`);
    console.log(`Current supply: ${Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals)}`);
    
    // Amount to mint: 1 billion tokens
    const amountToMint = 1_000_000_000;
    const amountInUnits = BigInt(amountToMint) * BigInt(Math.pow(10, mintInfo.decimals));
    
    console.log(`\nMinting ${amountToMint.toLocaleString()} WAGA tokens to vault...`);
    
    // Get or create the vault's associated token account
    const vaultATA = await getOrCreateAssociatedTokenAccount(
      connection,
      authorityKeypair,
      mintPubkey,
      vaultPubkey
    );
    
    console.log("Vault ATA:", vaultATA.address.toBase58());
    console.log("Current vault balance:", Number(vaultATA.amount) / Math.pow(10, mintInfo.decimals));
    
    // Mint tokens to the vault
    const txSig = await mintTo(
      connection,
      authorityKeypair,
      mintPubkey,
      vaultATA.address,
      authorityKeypair, // Mint authority
      amountInUnits
    );
    
    console.log(`\nSuccess! Minted ${amountToMint.toLocaleString()} WAGA tokens`);
    console.log("Transaction signature:", txSig);
    console.log(`View on Solana Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
    
    // Verify new balance
    const updatedVaultATA = await getOrCreateAssociatedTokenAccount(
      connection,
      authorityKeypair,
      mintPubkey,
      vaultPubkey
    );
    console.log(`\nNew vault balance: ${(Number(updatedVaultATA.amount) / Math.pow(10, mintInfo.decimals)).toLocaleString()} WAGA`);
    
  } catch (error) {
    console.error("Error minting tokens:", error);
    process.exit(1);
  }
}

mintWagaTokens();
