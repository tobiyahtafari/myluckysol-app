import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { WagaToken } from "../target/types/waga_token";
import * as fs from "fs";
import * as path from "path";

async function main() {
  // Configure the client to use the local/devnet cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WagaToken as Program<WagaToken>;

  const [tokenConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("waga_config")],
    program.programId
  );

  const [mintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("waga_mint")],
    program.programId
  );

  const [mintAuthorityPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("waga_mint_authority")],
    program.programId
  );

  // Mint 100 billion WAGA tokens (100,000,000,000 * 10^9 decimals)
  // Due to u64 limitations, we mint in batches
  const TOTAL_SUPPLY = 100_000_000_000; // 100 billion
  const DECIMALS = 9;
  const MAX_MINT_PER_TX = 10_000_000_000; // 10 billion per tx (safe u64)
  const recipient = provider.wallet.publicKey;

  console.log("Checking if token is initialized...");
  try {
    const config = await program.account.tokenConfig.fetch(tokenConfigPDA);
    console.log("Token already initialized. Authority:", config.authority.toString());
  } catch (e) {
    console.log("Initializing token...");
    await program.methods
      .initializeToken(9)
      .accounts({
        tokenConfig: tokenConfigPDA,
        mint: mintPDA,
        mintAuthority: mintAuthorityPDA,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log("Token initialized.");
  }

  const recipientTokenAccount = anchor.utils.token.associatedAddress({
    mint: mintPDA,
    owner: recipient,
  });

  console.log(`Target: Mint ${TOTAL_SUPPLY.toLocaleString()} WAGA tokens`);
  console.log(`Recipient: ${recipient.toString()}`);
  console.log(`Token Account: ${recipientTokenAccount.toString()}`);
  
  // Calculate number of mint transactions needed
  const numBatches = Math.ceil(TOTAL_SUPPLY / (MAX_MINT_PER_TX / (10 ** DECIMALS)));
  const amountPerBatch = new anchor.BN(MAX_MINT_PER_TX);
  
  let totalMinted = 0;
  
  for (let i = 0; i < 10; i++) { // Mint 10 batches of 10B each = 100B total
    const batchAmount = new anchor.BN(10_000_000_000).mul(new anchor.BN(10 ** DECIMALS)); // 10B with decimals
    
    console.log(`Minting batch ${i + 1}/10: 10,000,000,000 WAGA...`);
    
    try {
      await program.methods
        .mintReward(batchAmount)
        .accounts({
          tokenConfig: tokenConfigPDA,
          mint: mintPDA,
          mintAuthority: mintAuthorityPDA,
          recipientTokenAccount,
          recipient,
          payer: provider.wallet.publicKey,
          gameAuthority: provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      
      totalMinted += 10_000_000_000;
      console.log(`  Batch ${i + 1} complete. Total minted: ${totalMinted.toLocaleString()} WAGA`);
    } catch (err) {
      console.error(`  Batch ${i + 1} failed:`, err);
      break;
    }
  }

  console.log(`\nSuccessfully minted ${totalMinted.toLocaleString()} WAGA to ${recipient.toString()}`);
  console.log(`Mint address: ${mintPDA.toString()}`);
}

main().catch((err) => {
  console.error(err);
});
