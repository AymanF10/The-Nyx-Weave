import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TheNyxWeave } from '../target/types/the_nyx_weave'; // Your generated Anchor IDL type

// Initialize the Anchor provider and program
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.NyxWeave as Program<TheNyxWeave>;

export const PROGRAM_ID = new PublicKey(
  '2N1TRSvQTNxH52mhqbgn3XShtXZuPQoaAk1puGw2uJeF'
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
);

/* -------------------------------------------------------------
 *                     INTERNAL HELPERS
 * -----------------------------------------------------------*/
async function derivePda(seeds: (Buffer | Uint8Array)[], programId: PublicKey = PROGRAM_ID) {
  const [pda] = await PublicKey.findProgramAddressSync(seeds, programId);
  return pda;
}

/* -------------------------------------------------------------
 *                   INSTRUCTION BUILDERS
 * -----------------------------------------------------------*/

// Initialize Global Config
export async function initialize(
  admin: PublicKey,
  feeBps: number,
  maxRetries: number
) {
  const [globalConfig] = await derivePda([
    Buffer.from('config'),
    admin.toBuffer()
  ]);

  const [treasuryVault] = await derivePda([
    Buffer.from('treasury_vault'),
    globalConfig.toBuffer()
  ]);

  return program.methods.initialize(
    feeBps,
    maxRetries
  )
    .accounts({
      admin,
      globalConfig,
      treasuryVault,
      systemProgram: SystemProgram.programId
    })
    .instruction();
}

// Deposit to Treasury
export async function deposit(
  admin: PublicKey,
  mint: PublicKey,
  amount: anchor.BN,
  adminAta: PublicKey,
  vaultAta: PublicKey,
  usdcMint: PublicKey,
  wsolMint: PublicKey,
  jitoMint: PublicKey,
  adminUsdcAta: PublicKey,
  adminWsolAta: PublicKey,
  adminJitoAta: PublicKey,
  vaultUsdcAta: PublicKey,
  vaultWsolAta: PublicKey,
  vaultJitoAta: PublicKey
) {
  const [globalConfig] = await derivePda([
    Buffer.from('config'),
    admin.toBuffer()
  ]);

  const [treasuryVault] = await derivePda([
    Buffer.from('treasury_vault'),
    globalConfig.toBuffer()
  ]);

  return program.methods.deposit(
    mint,
    amount
  )
    .accountsPartial({
      admin,
      usdcMint,
      wsolMint,
      jitoMint,
      adminUsdcAta,
      adminWsolAta,
      adminJitoAta,
      globalConfig,
      treasuryVault,
      treasuryVaultUsdcAta: vaultUsdcAta,
      treasuryVaultWsolAta: vaultWsolAta,
      treasuryVaultJitoAta: vaultJitoAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
}

// Withdraw from Treasury
export async function withdraw(
  admin: PublicKey,
  mint: PublicKey,
  amount: anchor.BN,
  adminAta: PublicKey,
  vaultAta: PublicKey,
  usdcMint: PublicKey,
  wsolMint: PublicKey,
  jitoMint: PublicKey,
  adminUsdcAta: PublicKey,
  adminWsolAta: PublicKey,
  adminJitoAta: PublicKey,
  vaultUsdcAta: PublicKey,
  vaultWsolAta: PublicKey,
  vaultJitoAta: PublicKey
) {
  const [globalConfig] = await derivePda([
    Buffer.from('config'),
    admin.toBuffer()
  ]);

  const [treasuryVault] = await derivePda([
    Buffer.from('treasury_vault'),
    globalConfig.toBuffer()
  ]);

  return program.methods.withdraw(
    mint,
    amount
  )
    .accountsPartial({
      admin,
      usdcMint,
      wsolMint,
      jitoMint,
      adminUsdcAta,
      adminWsolAta,
      adminJitoAta,
      globalConfig,
      treasuryVault,
      treasuryVaultUsdcAta: vaultUsdcAta,
      treasuryVaultWsolAta: vaultWsolAta,
      treasuryVaultJitoAta: vaultJitoAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
}

// Withdraw All from Treasury
export async function withdrawAll(
  admin: PublicKey,
  usdcMint: PublicKey,
  wsolMint: PublicKey,
  jitoMint: PublicKey,
  adminUsdcAta: PublicKey,
  adminWsolAta: PublicKey,
  adminJitoAta: PublicKey,
  vaultUsdcAta: PublicKey,
  vaultWsolAta: PublicKey,
  vaultJitoAta: PublicKey
) {
  const globalConfig = await derivePda([
    Buffer.from('config'),
    admin.toBuffer()
  ]);

  const treasuryVault = await derivePda([
    Buffer.from('treasury_vault'),
    globalConfig.toBuffer()
  ]);

  return program.methods.withdrawAll()
    .accountsPartial({
      admin,
      usdcMint,
      wsolMint,
      jitoMint,
      adminUsdcAta,
      adminWsolAta,
      adminJitoAta,
      globalConfig,
      treasuryVault,
      treasuryVaultUsdcAta: vaultUsdcAta,
      treasuryVaultWsolAta: vaultWsolAta,
      treasuryVaultJitoAta: vaultJitoAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId
    })
    .instruction();
}

// Create Strategy
export async function createStrategy(
  admin: PublicKey,
  frequencySec: anchor.BN,
  durationSec: anchor.BN,
  depositTokenMint: PublicKey,
  hedgedTokenMint: PublicKey,
  percentageHedgeBps: anchor.BN,
  buyAmmKey: PublicKey,
  sellAmmKey: PublicKey,
  stopLossLimit?: anchor.BN,
  priceRange?: anchor.BN,
  backOffDelay?: anchor.BN,
  backOffRetry?: anchor.BN
) {
  const [strategyVault] = await derivePda([
    Buffer.from('strategy_vault'),
    admin.toBuffer()
  ]);

  return program.methods.createStrategy(
    frequencySec,
    durationSec,
    depositTokenMint,
    hedgedTokenMint,
    percentageHedgeBps,
    buyAmmKey,
    sellAmmKey,
    stopLossLimit || new anchor.BN(0),
    priceRange || new anchor.BN(0),
    backOffDelay || new anchor.BN(5),
    backOffRetry || new anchor.BN(3)
  )
    .accountsPartial({
      admin,
      strategyVault,
      systemProgram: SystemProgram.programId
    })
    .instruction();
}

/* -------------------------------------------------------------
 *                   TYPE DEFINITIONS
 * -----------------------------------------------------------*/
export interface GlobalConfig {
  admin: PublicKey;
  feeBps: number;
  maxRetries: number;
  bump: number;
}

export interface TreasuryVault {
  admin: PublicKey;
  totalProfitsSecured: anchor.BN;
  bump: number;
}

export interface StrategyVault {
  totalCapital: anchor.BN;
  bump: number;
  frequencySec: anchor.BN;
  durationSec: anchor.BN;
  depositTokenMint: PublicKey;
  hedgedTokenMint: PublicKey;
  percentageHedgeBps: anchor.BN;
  buyAmmKey: PublicKey;
  sellAmmKey: PublicKey;
  stopLossLimit: anchor.BN;
  priceRange: anchor.BN;
  backOffDelay: anchor.BN;
  backOffRetry: anchor.BN;
  lastTradeProfit: anchor.BN;
  totalTradesExecuted: anchor.BN;
}