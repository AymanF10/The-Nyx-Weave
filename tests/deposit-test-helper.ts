import * as borsh from "@coral-xyz/borsh";
import { PublicKey, SystemProgram, TransactionInstruction, VersionedTransaction, TransactionMessage } from "@solana/web3.js";
import { Program, BN } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { TheNyxWeave } from "../target/types/the_nyx_weave";

export class DepositorAccount {
  constructor(fields: Partial<DepositorAccount>) {
    Object.assign(this, fields);
  }
  depositor!: PublicKey;
  total_amount_deposited: BN = new BN(0);
  net_profit: BN = new BN(0);
  last_deposit_time: BN = new BN(0);
  depositor_bump: number = 0;
}

export const DepositorAccountSchema = borsh.struct([
  borsh.publicKey("depositor"),
  borsh.u64("total_amount_deposited"),
  borsh.u64("net_profit"),
  borsh.i64("last_deposit_time"),
  borsh.u8("depositor_bump"),
]);

export const DEPOSITOR_ACCOUNT_SIZE = 8 + 32 + 8 + 8 + 8 + 1;

export async function createFakeDepositorAccount({
  program,
  depositor,
  mint,
  netProfit,
  depositAmount,
  provider,
}: {
  program: Program<TheNyxWeave>;
  depositor: PublicKey;
  mint: PublicKey;
  netProfit: number;
  depositAmount: number;
  provider: anchor.AnchorProvider;
}): Promise<PublicKey> {

  const [depositorPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("depositor"), depositor.toBuffer(), mint.toBuffer()],
    program.programId
  );

  const space = DEPOSITOR_ACCOUNT_SIZE;
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(space);

  const createIx = SystemProgram.createAccount({
    fromPubkey: provider.wallet.publicKey,
    newAccountPubkey: depositorPDA,
    space,
    lamports,
    programId: program.programId,
  });

  const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash();

  // Create and sign versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: provider.wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [createIx],
  }).compileToV0Message();

  const createTx = new VersionedTransaction(messageV0);

  // Ensure we have the signer
  if (!provider.wallet.payer) {
    throw new Error("Wallet payer is required for signing transactions");
  }
  createTx.sign([provider.wallet.payer]);

  // Send with proper error handling
  let createTxId;
  try {
    createTxId = await provider.connection.sendTransaction(createTx);
    await provider.connection.confirmTransaction({
      signature: createTxId,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
  } catch (error) {
    console.error("Account creation failed:", error);
    if (error instanceof Error && 'logs' in error) {
      console.error("Transaction logs:", error.logs);
    }
    throw error;
  }

  const depositorData = new DepositorAccount({
    depositor,
    total_amount_deposited: new BN(depositAmount),
    net_profit: new BN(netProfit),
    last_deposit_time: new BN(Math.floor(Date.now() / 1000)),
    depositor_bump: bump,
  });



  const buffer = Buffer.alloc(space);
  const discriminator = program.idl.accounts.find(a => a.name === "depositorAccount")?.discriminator;
  if (!discriminator) {
    throw new Error("Could not find depositorAccount discriminator");
  }
  buffer.set(discriminator);
  DepositorAccountSchema.encode(depositorData, buffer.slice(8));




  const updateIx = new TransactionInstruction({
    keys: [{ pubkey: depositorPDA, isSigner: false, isWritable: true }],
    programId: program.programId,
    data: buffer,
  });

  const updateBlockhash = await provider.connection.getLatestBlockhash();

  const updateMessageV0 = new TransactionMessage({
    payerKey: provider.wallet.publicKey,
    recentBlockhash: updateBlockhash.blockhash,
    instructions: [updateIx],
  }).compileToV0Message();


  console.log("updateMessageV0: ", updateMessageV0);
  const updateTx = new VersionedTransaction(updateMessageV0);
  console.log(" signing updateTx");
  updateTx.sign([provider.wallet.payer]);
  console.log(" signed updateTx");

  console.log("updateTx: ", updateTx);

  try {
    const updateTxId = await provider.connection.sendTransaction(updateTx);
    await provider.connection.confirmTransaction({
      signature: updateTxId,
      blockhash: updateBlockhash.blockhash,
      lastValidBlockHeight: updateBlockhash.lastValidBlockHeight,
    }, 'confirmed');
  } catch (error) {
    console.error("Account initialization failed:", error);
    if (error instanceof Error && 'logs' in error) {
      console.error("Transaction logs:", error.logs);
    }
    throw error;
  }

  return depositorPDA;
}