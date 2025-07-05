import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";
import { NyxClient } from "../sdk/nyx-weave-client";
import { TheNyxWeave } from "../target/types/the_nyx_weave";

describe("Intra-Pool Arbitrage Platform", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;
  let client: NyxClient;

  // TEST SETUP 
  let usdcTokenMint: PublicKey;

  const deployer = provider.wallet;
  const newAdmin = anchor.web3.Keypair.generate();
  const depositor1 = anchor.web3.Keypair.generate();
  const unauthorizedUser = anchor.web3.Keypair.generate();
  const ammWallet = anchor.web3.Keypair.generate();

  before(async () => {
    client = new NyxClient(provider);
    
    // Setup actors with SOL
    await client.airdrop([newAdmin.publicKey, depositor1.publicKey, unauthorizedUser.publicKey, ammWallet.publicKey], 5);

    // Create USDC mint
    usdcTokenMint = await client.createMint({ authority: newAdmin });

    // Setup AMM wallet with tokens
    const ammWalletATA = await client.getOrCreateATA(usdcTokenMint, ammWallet);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: ammWalletATA.address, 
      authority: newAdmin, 
      amount: 500 * 10 ** 6 
    });
  });

  it("TEST 1: Initializing the Admins", async () => {
    await client.initAdmins(newAdmin);
    
    const admins = await client.getAdmins();
    expect(admins).to.include(newAdmin.publicKey.toBase58());
  });

  it("TEST 1.1: Attempting to initialize admins twice", async () => {
    try {
      await client.initAdmins(unauthorizedUser);
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 2: Initializing the Global Config And Treasury Vault", async () => {
    await client.initGlobalConfig({
      admin: newAdmin,
      feeBps: 1000,
      minProfitThreshold: 1000,
      maxRetries: 2
    });

    const globalConfig = await client.getGlobalConfig();
    expect(globalConfig.admin).deep.equal(newAdmin.publicKey);
    expect(globalConfig.feeBps.toNumber()).to.eq(1000);
    expect(globalConfig.maxRetries).to.eq(2);
    expect(globalConfig.minProfitThreshold.toNumber()).to.eq(1000);
  });

  it("Test 2.1: Unauthorized user trying to initialize global config", async () => {
    try {
      await client.initGlobalConfig({
        admin: unauthorizedUser,
        feeBps: 1000,
        minProfitThreshold: 1000,
        maxRetries: 2
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 2.2: Attempting to initialize with invalid parameters", async () => {
    try {
      await client.initGlobalConfig({
        admin: newAdmin,
        feeBps: 1000,
        minProfitThreshold: 1000,
        maxRetries: 5 // Max retries > 3
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 3: Creating Strategy Vault", async () => {
    await client.createStrategyVault({
      admin: newAdmin,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    expect(strategyVault.isActive).to.be.true;
    expect(strategyVault.totalDeposits.toNumber()).to.eq(0);
    expect(strategyVault.riskLevel).to.eq(1);
    expect(strategyVault.isDelegated).to.be.false;
    expect(strategyVault.depositTokenMint).deep.equal(usdcTokenMint);
  });

  it("TEST 3.1: Unauthorized user trying to create strategy vault", async () => {
    try {
      await client.createStrategyVault({
        admin: unauthorizedUser,
        mint: usdcTokenMint,
        riskLevel: 2
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 3.2: Attempting to create duplicate strategy vault", async () => {
    try {
      await client.createStrategyVault({
        admin: newAdmin,
        mint: usdcTokenMint,
        riskLevel: 1 // Same risk level as existing
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4: User Making Deposits Into A Strategy Vault", async () => {
    // Setup depositor with tokens
    const depositor1ATA = await client.getOrCreateATA(usdcTokenMint, depositor1);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor1ATA.address, 
      authority: newAdmin, 
      amount: 500 * 10 ** 6 
    });

    await client.userDeposit({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 400 * 10 ** 6
    });

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      usdcTokenMint.toBuffer(),
      Buffer.from([1])
    ], program.programId);
    const depositorAccount = await client.getDepositorAccount(depositor1.publicKey, usdcTokenMint, strategyVaultPDA);
    const depositorBalance = await client.getAccount(depositor1ATA.address);

    expect(depositorAccount.depositor).deep.equal(depositor1.publicKey);
    expect(depositorAccount.totalAmountDeposited.toNumber()).to.eq(400 * 10 ** 6);
    expect(strategyVault.totalDeposits.toNumber()).to.eq(400 * 10 ** 6);
    expect(Number(depositorBalance.amount)).to.eq(100 * 10 ** 6);
  });

  it("TEST 4.1: Attempting to deposit with insufficient funds", async () => {
    try {
      await client.userDeposit({
        depositor: depositor1,
        mint: usdcTokenMint,
        riskLevel: 1,
        amount: 200 * 10 ** 6 // More than available balance
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4.2: Attempting to deposit to non-existent strategy vault", async () => {
    try {
      await client.userDeposit({
        depositor: depositor1,
        mint: usdcTokenMint,
        riskLevel: 99, // Non-existent risk level
        amount: 50 * 10 ** 6
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5: User Making Withdrawals From An Undelegated Strategy Vault", async () => {
    await client.userWithdraw({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 300 * 10 ** 6
    });

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    const [strategyVaultPDA2] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      usdcTokenMint.toBuffer(),
      Buffer.from([1])
    ], program.programId);
    const depositorAccount = await client.getDepositorAccount(depositor1.publicKey, usdcTokenMint, strategyVaultPDA2);
    const depositorATA = getAssociatedTokenAddressSync(usdcTokenMint, depositor1.publicKey);
    const depositorBalance = await client.getAccount(depositorATA);

    expect(depositorAccount.depositor).deep.equal(depositor1.publicKey);
    expect(depositorAccount.totalAmountDeposited.toNumber()).to.eq(100 * 10 ** 6);
    expect(strategyVault.totalDeposits.toNumber()).to.eq(100 * 10 ** 6);
    expect(Number(depositorBalance.amount)).to.eq(400 * 10 ** 6);
  });

  it("TEST 5.1: Attempting to withdraw more than deposited", async () => {
    try {
      await client.userWithdraw({
        depositor: depositor1,
        mint: usdcTokenMint,
        riskLevel: 1,
        amount: 200 * 10 ** 6 // More than deposited
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5.2: Unauthorized user attempting to withdraw", async () => {
    try {
      await client.userWithdraw({
        depositor: unauthorizedUser,
        mint: usdcTokenMint,
        riskLevel: 1,
        amount: 50 * 10 ** 6
      });
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it.skip("TEST 5.3: Simulating withdrawal from a delegated vault", async () => {
    console.log("Note: In a real scenario, if the strategy vault is delegated (is_delegated = true), the withdrawal would fail with VaultInDelegation error.");
    console.log("This test is a placeholder for that scenario, as we can't directly modify the vault state.");
  });

  it("TEST 6.1: Execution bot executing arbitrage and User claiming profit from treasury vault", async () => {
    // Setup depositor with more tokens for this test
    const depositor1ATA = await client.getOrCreateATA(usdcTokenMint, depositor1);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor1ATA.address, 
      authority: newAdmin, 
      amount: 500 * 10 ** 6 
    });

    // Make a deposit
    await client.userDeposit({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 400 * 10 ** 6
    });

    // Execute arbitrage mock
    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 50 * 10 ** 6
    });

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    expect(strategyVault.totalProfit.toNumber()).to.eq(50 * 10 ** 6);

    // Get balance before claim
    const depositorBalanceBefore = await client.getAccount(depositor1ATA.address);

    // Claim profit
    await client.claimProfit({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    const depositorBalanceAfter = await client.getAccount(depositor1ATA.address);

    console.log("Balance before claim:", Number(depositorBalanceBefore.amount));
    console.log("Balance after claim:", Number(depositorBalanceAfter.amount));
  });

  it("TEST 6.2: User with no profit attempting to claim profit", async () => {
    // This test would require a user with no profit to attempt claiming
    // Implementation depends on the specific business logic
  });

  it("TEST 6.3: User claiming profit from treasury vault with insufficient funds", async () => {
    // This test would require the treasury vault to have insufficient funds
    // Implementation depends on the specific business logic
  });

  it("TEST 6.4: User claiming profit from treasury vault with multiple strategy vaults", async () => {
    // This test would require multiple strategy vaults
    // Implementation depends on the specific business logic
  });

  it("TEST 6.5: Users claiming profit from treasury vault from same strategy vault", async () => {
    // This test would require multiple users claiming from the same vault
    // Implementation depends on the specific business logic
  });
});