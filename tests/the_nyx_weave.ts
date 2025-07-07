import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import DLMM, {
  ActivationType,
  deriveCustomizablePermissionlessLbPair,
  StrategyType,
} from "@meteora-ag/dlmm";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "bn.js";
import {
  getOrCreateAssociatedTokenAccount,
  createMint,
  mintTo,
} from "@solana/spl-token";


describe("Meteora DLMM Arbitrage Setup and Execution", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  let user: Keypair;
  let trumpMint: PublicKey;
  let usdcMint: PublicKey;
  let userTrumpTokenAccount: any;
  let userUsdcTokenAccount: any;
  let poolAAddress: PublicKey;
  let poolBAddress: PublicKey;
  let dlmmPoolA: DLMM;
  let dlmmPoolB: DLMM;
  let positionA: Keypair;
  let positionB: Keypair;

  before(async () => {
    user = Keypair.generate();
    await connection.requestAirdrop(user.publicKey, 5 * LAMPORTS_PER_SOL);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    trumpMint = await createMint(connection, user, user.publicKey, null, 6);
    usdcMint = await createMint(connection, user, user.publicKey, null, 6);

    userTrumpTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection, user, trumpMint, user.publicKey
    );
    userUsdcTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection, user, usdcMint, user.publicKey
    );
    const amountToMint = 100_000 * 1_000_000;
    await mintTo(connection, user, trumpMint, userTrumpTokenAccount.address, user, amountToMint);
    await mintTo(connection, user, usdcMint, userUsdcTokenAccount.address, user, amountToMint);
  });

  it("Creates two DLMM pools and derives their addresses", async () => {
    const DLMM_PROGRAM_ID = new PublicKey("LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo");
    const binStep = new BN(25);
    const feeBps = new BN(30);
    const activationType = ActivationType.Timestamp;
    const hasAlphaVault = false;
    const activeIdA = new BN(8388608);
    const activeIdB = new BN(8400000);

    const randomPool = new PublicKey("7q7c6ZXiq6ysUUCmjGF4YYPaaQAhTgtztJsx2amChAuY");
    const dlmmPool = await DLMM.create(connection, randomPool);
    const activeBin = await dlmmPool.getActiveBin();
const activeBinPriceLamport = activeBin.price;
const activeBinPricePerToken = dlmmPool.fromPricePerLamport(
  Number(activeBin.price)
);
    console.log(`Active Bin Price (Lamports): ${activeBinPriceLamport}`);
    console.log(`Active Bin Price (Per Token): ${activeBinPricePerToken}`); 


    // Pool A
    const createPoolATx = await DLMM.createCustomizablePermissionlessLbPair2(
      connection,
      binStep,
      trumpMint,
      usdcMint,
      activeIdA,
      feeBps,
      activationType,
      hasAlphaVault,
      user.publicKey,
      undefined,
      false
    );
    await sendAndConfirmTransaction(connection, createPoolATx, [user]);
    [poolAAddress] = deriveCustomizablePermissionlessLbPair(
      trumpMint, usdcMint, DLMM_PROGRAM_ID
    );

    // Pool B (swap token order for unique pool)
    
    const createPoolBTx = await DLMM.createCustomizablePermissionlessLbPair2(
      connection,
      binStep,
      usdcMint,
      trumpMint,
      activeIdB,
      feeBps,
      activationType,
      hasAlphaVault,
      user.publicKey,
      undefined,
      false
    );
    await sendAndConfirmTransaction(connection, createPoolBTx, [user]);
    [poolBAddress] = deriveCustomizablePermissionlessLbPair(
      usdcMint, trumpMint, DLMM_PROGRAM_ID
    );

    dlmmPoolA = await DLMM.create(connection, poolAAddress);
    dlmmPoolB = await DLMM.create(connection, poolBAddress);
  });

  // it("Adds imbalanced liquidity to create price differences", async () => {
  //   const activeBinA = await dlmmPoolA.getActiveBin();
  //   const activeBinB = await dlmmPoolB.getActiveBin();
  //   positionA = Keypair.generate();
  //   positionB = Keypair.generate();

  //   // Pool A: more USDC (TRUMP cheaper)
  //   const RANGE_INTERVAL = 5;
  //   const minBinIdA = activeBinA.binId - RANGE_INTERVAL;
  //   const maxBinIdA = activeBinA.binId + RANGE_INTERVAL;
  //   const totalXAmountA = new BN(1000 * 1_000_000);
  //   const totalYAmountA = new BN(1200 * 1_000_000);

  //   const createPositionATx = await dlmmPoolA.initializePositionAndAddLiquidityByStrategy({
  //     positionPubKey: positionA.publicKey,
  //     user: user.publicKey,
  //     totalXAmount: totalXAmountA,
  //     totalYAmount: totalYAmountA,
  //     strategy: {
  //       maxBinId: maxBinIdA,
  //       minBinId: minBinIdA,
  //       strategyType: StrategyType.Spot,
  //     },
  //   });
  //   await sendAndConfirmTransaction(connection, createPositionATx, [user, positionA]);

  //   // Pool B: more TRUMP (TRUMP expensive)
  //   const minBinIdB = activeBinB.binId - RANGE_INTERVAL;
  //   const maxBinIdB = activeBinB.binId + RANGE_INTERVAL;
  //   const totalXAmountB = new BN(1200 * 1_000_000);
  //   const totalYAmountB = new BN(1000 * 1_000_000);

  //   const createPositionBTx = await dlmmPoolB.initializePositionAndAddLiquidityByStrategy({
  //     positionPubKey: positionB.publicKey,
  //     user: user.publicKey,
  //     totalXAmount: totalXAmountB,
  //     totalYAmount: totalYAmountB,
  //     strategy: {
  //       maxBinId: maxBinIdB,
  //       minBinId: minBinIdB,
  //       strategyType: StrategyType.Spot,
  //     },
  //   });
  //   await sendAndConfirmTransaction(connection, createPositionBTx, [user, positionB]);

  //   await dlmmPoolA.refetchStates();
  //   await dlmmPoolB.refetchStates();
  //   const newActiveBinA = await dlmmPoolA.getActiveBin();
  //   const newActiveBinB = await dlmmPoolB.getActiveBin();
  //   const priceA = dlmmPoolA.fromPricePerLamport(Number(newActiveBinA.price));
  //   const priceB = dlmmPoolB.fromPricePerLamport(Number(newActiveBinB.price));
  //   console.log(`Pool A price: ${priceA}, Pool B price: ${priceB}`);
  // });

  // it("Executes atomic arbitrage swaps between two pools", async () => {
  //   await dlmmPoolA.refetchStates();
  //   await dlmmPoolB.refetchStates();

  //   const swapAmountUSDC = new BN(100 * 1_000_000);
  //   const slippageBps = new BN(300);

  //   const binArraysA = await dlmmPoolA.getBinArrayForSwap(false);
  //   const binArraysB = await dlmmPoolB.getBinArrayForSwap(true);

  //   const quoteA = await dlmmPoolA.swapQuote(
  //     swapAmountUSDC,
  //     false,
  //     slippageBps,
  //     binArraysA
  //   );
  //   const quoteB = await dlmmPoolB.swapQuote(
  //     quoteA.minOutAmount,
  //     true,
  //     slippageBps,
  //     binArraysB
  //   );

  //   const profit = quoteB.minOutAmount.sub(swapAmountUSDC);
  //   if (profit.lte(new BN(0))) {
  //     console.log(`No profitable arbitrage. Loss: ${profit.abs().toString()} USDC`);
  //     return;
  //   }
  //   console.log(`Potential profit: ${profit.toString()} USDC`);

  //   const swapTxA = await dlmmPoolA.swap({
  //     inToken: usdcMint,
  //     binArraysPubkey: quoteA.binArraysPubkey,
  //     inAmount: swapAmountUSDC,
  //     lbPair: poolAAddress,
  //     user: user.publicKey,
  //     minOutAmount: quoteA.minOutAmount,
  //     outToken: trumpMint,
  //   });
  //   const swapTxB = await dlmmPoolB.swap({
  //     inToken: trumpMint,
  //     binArraysPubkey: quoteB.binArraysPubkey,
  //     inAmount: quoteA.minOutAmount,
  //     lbPair: poolBAddress,
  //     user: user.publicKey,
  //     minOutAmount: quoteB.minOutAmount,
  //     outToken: usdcMint,
  //   });

  //   const atomicTransaction = new Transaction()
  //     .add(...swapTxA.instructions)
  //     .add(...swapTxB.instructions);

  //   const signature = await sendAndConfirmTransaction(
  //     connection,
  //     atomicTransaction,
  //     [user],
  //     { skipPreflight: false }
  //   );
  //   console.log("Arbitrage executed! Signature:", signature);
  // });
});

