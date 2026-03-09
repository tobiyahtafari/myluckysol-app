import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { 
  createMint, 
  mintTo, 
  getOrCreateAssociatedTokenAccount,
  getMint
} from "@solana/spl-token";
import bs58 from "bs58";

const MAINNET_RPC = "https://mainnet.helius-rpc.com/?api-key=eefa5aa4-0358-4152-8a1d-60bacc3a2670";
const DEVNET_RPC = "https://api.devnet.solana.com";

async function createWagaToken() {
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
    
    console.log("=== WAGA Token Creation Script ===\n");
    console.log("Authority/Vault wallet:", authorityKeypair.publicKey.toBase58());
    
    // Check balance
    const balance = await connection.getBalance(authorityKeypair.publicKey);
    console.log(`Authority balance: ${balance / 1e9} SOL`);
    
    if (balance < 0.1 * 1e9) {
      console.log("\nInsufficient balance. Requesting airdrop...");
      const airdropSig = await connection.requestAirdrop(authorityKeypair.publicKey, 2 * 1e9);
      await connection.confirmTransaction(airdropSig);
      console.log("Airdrop confirmed!");
    }
    
    console.log("\n1. Creating new WAGA token mint...");
    
    // Create the token mint with 6 decimals (like USDC)
    const decimals = 6;
    const mintAddress = await createMint(
      connection,
      authorityKeypair,      // Payer
      authorityKeypair.publicKey, // Mint authority
      authorityKeypair.publicKey, // Freeze authority (optional)
      decimals
    );
    
    console.log("   WAGA Token Mint created:", mintAddress.toBase58());
    
    console.log("\n2. Creating token account for vault...");
    
    // Create associated token account for the vault (same as authority)
    const vaultATA = await getOrCreateAssociatedTokenAccount(
      connection,
      authorityKeypair,
      mintAddress,
      authorityKeypair.publicKey
    );
    
    console.log("   Vault ATA:", vaultATA.address.toBase58());
    
    console.log("\n3. Minting 1,000,000,000 WAGA tokens to vault...");
    
    // Mint 1 billion tokens
    const amountToMint = 1_000_000_000;
    const amountInUnits = BigInt(amountToMint) * BigInt(Math.pow(10, decimals));
    
    const mintTxSig = await mintTo(
      connection,
      authorityKeypair,
      mintAddress,
      vaultATA.address,
      authorityKeypair,
      amountInUnits
    );
    
    console.log("   Mint transaction:", mintTxSig);
    
    // Verify
    const mintInfo = await getMint(connection, mintAddress);
    const finalBalance = Number(mintInfo.supply) / Math.pow(10, decimals);
    
    console.log("\n=== SUCCESS ===");
    console.log(`WAGA Token Mint: ${mintAddress.toBase58()}`);
    console.log(`Vault ATA: ${vaultATA.address.toBase58()}`);
    console.log(`Total Supply: ${finalBalance.toLocaleString()} WAGA`);
    console.log(`\nView on Explorer: https://explorer.solana.com/address/${mintAddress.toBase58()}?cluster=devnet`);
    
    console.log("\n=== UPDATE REQUIRED ===");
    console.log("Update shared/constants.ts with:");
    console.log(`export const WAGA_TOKEN_MINT = "${mintAddress.toBase58()}";`);
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

createWagaToken();
