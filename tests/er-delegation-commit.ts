import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
    GetCommitmentSignature
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync
} from "@solana/spl-token";
import {
    Keypair,
    PublicKey
} from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { loadKeypair } from "../simulate/util";
import { TheNyxWeave } from "../target/types/the_nyx_weave";

describe("Ephemeral Rollup Delegation and Commit Tests", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Ephemeral Rollup Provider
  const ephemeralProvider = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      process.env.PROVIDER_ENDPOINT || "https://devnet.magicblock.app/",
      { wsEndpoint: process.env.WS_ENDPOINT || "wss://devnet.magicblock.app/" }
    ),
    anchor.Wallet.local()
  );

  const program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;
  let client: NyxWeaveClient;

  // TEST SETUP - Load keypairs from setup script
  let usdcTokenMint: PublicKey;
  let deployer: Keypair;
  let admin: Keypair;
  let ammWallet: Keypair;
  let testUser1: Keypair;
  let testUser2: Keypair;
  let testUser3: Keypair;
  let testUser4: Keypair;
  let testUser5: Keypair;
  let unauthorizedUser: Keypair;

  // Load program state from setup script
  let programState: any;

  before(async () => {
    console.log("🔧 Setting up test environment...");
    
    // Load keypairs from setup script
    try {
      deployer = loadKeypair("./simulate/deployer-keypair.json");
      admin = loadKeypair("./simulate/admin-keypair.json");
      ammWallet = loadKeypair("./simulate/amm-wallet.json");
      testUser1 = loadKeypair("./simulate/test-user-1.json");
      testUser2 = loadKeypair("./simulate/test-user-2.json");
      testUser3 = loadKeypair("./simulate/test-user-3.json");
      testUser4 = loadKeypair("./simulate/test-user-4.json");
      testUser5 = loadKeypair("./simulate/test-user-5.json");
      unauthorizedUser = loadKeypair("./simulate/unauthorized-user.json");
      console.log("✅ Loaded existing keypairs from setup script");
    } catch (error) {
      console.log("❌ Failed to load keypairs. Please run the setup script first:");
      console.log("   npm run setup:devnet");
      throw error;
    }

    console.log("✅ Loaded test user keypairs from setup script");

    // Load program state from setup script
    const statePath = path.join(__dirname, "../simulate/nyx_state.json");
    if (fs.existsSync(statePath)) {
      programState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      usdcTokenMint = new PublicKey(programState.usdcMint);
      console.log("✅ Loaded program state from setup script");
    } else {
      console.log("❌ Program state not found. Please run the setup script first:");
      console.log("   npm run setup:devnet");
      throw new Error("Program state not found");
    }

    // Initialize client
    client = new NyxWeaveClient(provider);
    console.log("✅ Initialized NyxWeave client");

    // Note: Skipping airdrops to avoid 429 error codes
    // Users will need to be funded manually or through other means
    console.log("💰 Skipping airdrops to avoid rate limiting (429 errors)");
    console.log("⚠️ Please ensure user accounts have sufficient SOL for testing");

    // Note: Test users are already funded with USDC in the setup script
    console.log("🪙 Test users already funded with USDC from setup script");

    console.log("🎉 Test environment setup complete!");
    console.log("📊 Current state:");
    console.log("- USDC Mint:", usdcTokenMint.toBase58());
    console.log("- Deployer:", deployer.publicKey.toBase58());
    console.log("- Admin:", admin.publicKey.toBase58());
    console.log("- AMM Wallet:", ammWallet.publicKey.toBase58());
    console.log("- Test User 1:", testUser1.publicKey.toBase58());
    console.log("- Test User 2:", testUser2.publicKey.toBase58());
    console.log("- Test User 3:", testUser3.publicKey.toBase58());
    console.log("- Test User 4:", testUser4.publicKey.toBase58());
    console.log("- Test User 5:", testUser5.publicKey.toBase58());
    console.log("- Unauthorized User:", unauthorizedUser.publicKey.toBase58());
  });

  it("TEST 6  :::  Delegating Strategy Vault", async () => {
    // Get The PDA
    const riskLevel = 1;
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([riskLevel])],
      program.programId
    );

    const strategyVaultATA = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      program.programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    let delegation_tx = await program.methods
      .delegateStrategy(usdcTokenMint, riskLevel)
      .accounts({
        caller: deployer.publicKey,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
        vaultTokenAccount: strategyVaultATA,
      })
      .transaction();
      // For Delegating, fee payer is the base layer provider wallet
      delegation_tx.feePayer = provider.wallet.publicKey;
      
      delegation_tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
      // ER signs transaction below
      delegation_tx = await ephemeralProvider.wallet.signTransaction(delegation_tx);

      // Base Layer Provider send and confirm transaction
      const txHash = await provider.sendAndConfirm(delegation_tx, [], {
        skipPreflight: true,
        commitment: "confirmed"
      });
      console.log("Delegation Tx Hash on Base Layer is: ", txHash);

  });

  it("TEST 7 ::: Commit Arbitrage Without Undelegating", async () => {
    // Get The PDA
    const riskLevel = 1;
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([riskLevel])],
      program.programId
    );

    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    const strategyVaultATA = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      program.programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    let commit_no_undelegate_tx = await program.methods
      .commitArbitrageNoUndelegate()
      .accounts({
        caller: deployer.publicKey,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
        admins: adminPDA,
        vaultTokenAccount: strategyVaultATA,
      })
      .transaction();
      commit_no_undelegate_tx.feePayer = ephemeralProvider.wallet.publicKey;
      
      commit_no_undelegate_tx.recentBlockhash = (await ephemeralProvider.connection.getLatestBlockhash()).blockhash;
      commit_no_undelegate_tx = await ephemeralProvider.wallet.signTransaction(commit_no_undelegate_tx);
      const commit_no_undelegate_tx_hash = await ephemeralProvider.sendAndConfirm(
        commit_no_undelegate_tx, [], {skipPreflight: true}
      );

      // Get Commitment Signature
      const commitSignature = await GetCommitmentSignature(
        commit_no_undelegate_tx_hash,
        ephemeralProvider.connection
      );

      // log tx on base
      console.log("commit transaction on base is: ", commitSignature);

  });

  it("TEST 8 ::: Commit Arbitrage And Undelegate From ER", async () => {
    // Get The PDA
    const riskLevel = 1;
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([riskLevel])],
      program.programId
    );
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    const strategyVaultATA = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      program.programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    let commit_and_undelegate_tx = await program.methods
      .commitArbitrageAndUndelegate()
      .accounts({
        caller: deployer.publicKey,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
        admins: adminPDA,
        vaultTokenAccount: strategyVaultATA,
      })
      .transaction();
      // Base Layer provider wallet as fee payer
      commit_and_undelegate_tx.feePayer = provider.wallet.publicKey;
      // Recent Blockhash of ER
      commit_and_undelegate_tx.recentBlockhash = (await ephemeralProvider.connection.getLatestBlockhash()).blockhash;
      // ER wallet signs transaction
      commit_and_undelegate_tx = await ephemeralProvider.wallet.signTransaction(commit_and_undelegate_tx);
      // ER will send and confirm transaction
      const commit_and_undelegate_tx_hash = await ephemeralProvider.sendAndConfirm(
        commit_and_undelegate_tx, [], {skipPreflight: true}
      );
      console.log("Commit And Undelegate from ER tx hash is: ", commit_and_undelegate_tx_hash);
  });

  // Additional test for user deposits and withdrawals
  it("TEST 9 ::: User Deposit and Withdrawal", async () => {
    const riskLevel = 1;
    const depositAmount = 100 * 10 ** 6; // 100 USDC

    // User deposits into strategy vault
    await client.userDeposit(
      testUser1,
      usdcTokenMint,
      riskLevel,
      depositAmount
    );

    // Verify deposit
    const strategyVault = await client.getStrategyVault(usdcTokenMint, riskLevel);
    expect(strategyVault.totalDeposits.toNumber()).to.be.gte(depositAmount);

    // User withdraws from strategy vault
    const withdrawAmount = 50 * 10 ** 6; // 50 USDC
    await client.userWithdraw(
      testUser1,
      usdcTokenMint,
      riskLevel,
      withdrawAmount
    );

    console.log("✅ User deposit and withdrawal test completed");
  });

  // Test for executing arbitrage mock
  it("TEST 10 ::: Execute Arbitrage Mock", async () => {
    const riskLevel = 1;
    const arbitrageAmount = 50 * 10 ** 6; // 50 USDC

    const txHash = await client.executeArbitrageMock(
      ammWallet,
      usdcTokenMint,
      riskLevel,
      arbitrageAmount
    );

    console.log("✅ Arbitrage mock executed:", txHash);
  });

  // Test for claiming profits
  it("TEST 11 ::: Claim Profits", async () => {
    const riskLevel = 1;

    const txHash = await client.claimProfit(
      testUser1,
      usdcTokenMint,
      riskLevel
    );

    console.log("✅ Profit claim executed:", txHash);
  });
});