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

  const amount = new anchor.BN(1000 * 10 ** 9); // Mint 1000 WAGA
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

  console.log("Minting rewards...");
  await program.methods
    .mintReward(amount)
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

  console.log(`Successfully minted 1000 WAGA to ${recipient.toString()}`);
}

main().catch((err) => {
  console.error(err);
});
