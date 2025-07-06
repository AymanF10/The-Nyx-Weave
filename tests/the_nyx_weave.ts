import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import * as spl from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { TheNyxWeave } from "../target/types/the_nyx_weave";

describe("Intra-Pool Arbitrage Platform", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;
  let client: NyxWeaveClient;

  // TEST SETUP 
  let usdcTokenMint: PublicKey;

  const deployer = provider.wallet;
  const newAdmin = anchor.web3.Keypair.generate();
  const depositor1 = anchor.web3.Keypair.generate();
  const unauthorizedUser = anchor.web3.Keypair.generate();
  const ammWallet = anchor.web3.Keypair.generate();

  before(async () => {
    client = new NyxWeaveClient(provider);
    
    // Setup actors with SOL
    for (const pubkey of [newAdmin.publicKey, depositor1.publicKey, unauthorizedUser.publicKey, ammWallet.publicKey]) {
      const airdropSig = await provider.connection.requestAirdrop(pubkey, 5 * 1e9);
      await provider.connection.confirmTransaction(airdropSig, "confirmed");
    }

    // Create USDC mint
    usdcTokenMint = await spl.createMint(
      provider.connection,
      newAdmin,
      newAdmin.publicKey,
      null,
      6 // decimals
    );

    // Setup AMM wallet with tokens
    const ammWalletATA = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      ammWallet.publicKey
    );
    
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      ammWalletATA.address,
      newAdmin,
      500 * 10 ** 6
    );
  });

  it("TEST 1: Initializing the Admins", async () => {
    await client.initializeAdministrators(newAdmin.publicKey);
    
    const admins = await client.getAdministrators();
    expect(admins.exists).to.be.true;
  });

  it("TEST 1.1: Attempting to initialize admins twice", async () => {
    try {
      await client.initializeAdministrators(unauthorizedUser.publicKey);
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 2: Initializing the Global Config And Treasury Vault", async () => {
    await client.initializeConfigTreasury(
      newAdmin,
      1000, // feeBps
      1000, // minProfitThreshold
      2     // maxRetries
    );

    const globalConfig = await client.getGlobalConfig();
    expect(globalConfig.admin).to.equal(newAdmin.publicKey.toBase58());
    expect(globalConfig.feeBps).to.eq(1000);
    expect(globalConfig.exists).to.be.true;
  });

  it("Test 2.1: Unauthorized user trying to initialize global config", async () => {
    try {
      await client.initializeConfigTreasury(
        unauthorizedUser,
        1000, // feeBps
        1000, // minProfitThreshold
        2     // maxRetries
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 2.2: Attempting to initialize with invalid parameters", async () => {
    try {
      await client.initializeConfigTreasury(
        newAdmin,
        1000, // feeBps
        1000, // minProfitThreshold
        5     // maxRetries > 3
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 3: Creating Strategy Vault", async () => {
    await client.createStrategy(
      newAdmin,
      usdcTokenMint,
      1
    );

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    expect(strategyVault.exists).to.be.true;
    expect(strategyVault.address).to.be.a('string');
  });

  it("TEST 3.1: Unauthorized user trying to create strategy vault", async () => {
    try {
      await client.createStrategy(
        unauthorizedUser,
        usdcTokenMint,
        2
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 3.2: Attempting to create duplicate strategy vault", async () => {
    try {
      await client.createStrategy(
        newAdmin,
        usdcTokenMint,
        1 // Same risk level as existing
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4: User Making Deposits Into A Strategy Vault", async () => {
    // Setup depositor with tokens
    const depositor1ATA = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor1.publicKey
    );
    
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor1ATA.address,
      newAdmin,
      500 * 10 ** 6
    );

    await client.userDeposit(
      depositor1,
      usdcTokenMint,
      1,
      400 * 10 ** 6
    );

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    const depositorBalance = await spl.getAccount(provider.connection, depositor1ATA.address);

    expect(strategyVault.exists).to.be.true;
    expect(Number(depositorBalance.amount)).to.eq(100 * 10 ** 6);
  });

  it("TEST 4.1: Attempting to deposit with insufficient funds", async () => {
    try {
      await client.userDeposit(
        depositor1,
        usdcTokenMint,
        1,
        200 * 10 ** 6 // More than available balance
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4.2: Attempting to deposit to non-existent strategy vault", async () => {
    try {
      await client.userDeposit(
        depositor1,
        usdcTokenMint,
        99, // Non-existent risk level
        50 * 10 ** 6
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5: User Making Withdrawals From An Undelegated Strategy Vault", async () => {
    await client.userWithdraw(
      depositor1,
      usdcTokenMint,
      1,
      300 * 10 ** 6
    );

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    const depositorATA = spl.getAssociatedTokenAddressSync(usdcTokenMint, depositor1.publicKey);
    const depositorBalance = await spl.getAccount(provider.connection, depositorATA);

    expect(strategyVault.exists).to.be.true;
    expect(Number(depositorBalance.amount)).to.eq(400 * 10 ** 6);
  });

  it("TEST 5.1: Attempting to withdraw more than deposited", async () => {
    try {
      await client.userWithdraw(
        depositor1,
        usdcTokenMint,
        1,
        200 * 10 ** 6 // More than deposited
      );
      assert.fail("The transaction should have failed");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5.2: Unauthorized user attempting to withdraw", async () => {
    try {
      await client.userWithdraw(
        unauthorizedUser,
        usdcTokenMint,
        1,
        50 * 10 ** 6
      );
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

    const depositAmount = 400 * 10 ** 6;
    const profitAmount = 50 * 10 ** 6;

    // Setup depositor with more tokens for this test
    const depositor1ATA = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor1.publicKey
    );
    
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor1ATA.address,
      newAdmin,
      depositAmount
    );

    // Make a deposit
    await client.userDeposit(
      depositor1,
      usdcTokenMint,
      1,
      depositAmount
    );

    // Execute arbitrage mock
    await client.executeArbitrageMock(
      ammWallet,
      usdcTokenMint,
      1,
      profitAmount
    );

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    expect(strategyVault.exists).to.be.true;

    // Get balance before claim
    const depositorBalanceBefore = await spl.getAccount(provider.connection, depositor1ATA.address);

    // Claim profit
    await client.claimProfit(
      depositor1,
      usdcTokenMint,
      1
    );

    const depositorBalanceAfter = await spl.getAccount(provider.connection, depositor1ATA.address);
    assert.isAbove(Number(depositorBalanceAfter.amount), Number(depositorBalanceBefore.amount));
  });

  it("TEST 6.2: User with no profit attempting to claim profit", async () => {
    // Create a new depositor who hasn't participated in any arbitrage
    const depositor2 = anchor.web3.Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(depositor2.publicKey, 5 * 1e9);
    await provider.connection.confirmTransaction(airdropSig, "confirmed");
    
    const depositor2ATA = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor2.publicKey
    );
    
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor2ATA.address,
      newAdmin,
      100 * 10 ** 6
    );

    // Make a deposit but no arbitrage has been executed
    await client.userDeposit(
      depositor2,
      usdcTokenMint,
      1,
      50 * 10 ** 6
    );

    try {
      await client.claimProfit(
        depositor2,
        usdcTokenMint,
        1
      );
      assert.fail("Should fail when no profit is available");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it.skip("TEST 6.3: User claiming profit from treasury vault with insufficient funds", async () => {
    // Create a new depositor
    const depositor3 = anchor.web3.Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(depositor3.publicKey, 5 * 1e9);
    await provider.connection.confirmTransaction(airdropSig, "confirmed");
    
    const depositor3ATA = await spl.getOrCreateAssociatedTokenAccount(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor3.publicKey
    );
    
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor3ATA.address,
      newAdmin,
      100 * 10 ** 6
    );

    // Make a deposit
    await client.userDeposit(
      depositor3,
      usdcTokenMint,
      1,
      50 * 10 ** 6
    );

    // Execute arbitrage to generate profit
    await client.executeArbitrageMock(
      ammWallet,
      usdcTokenMint,
      1,
      25 * 10 ** 6
    );

    // Claim profit once (this should work)
    await client.claimProfit(
      depositor3,
      usdcTokenMint,
      1
    );

    // Try to claim again immediately (should fail due to insufficient funds in treasury)
    try {
      await client.claimProfit(
        depositor3,
        usdcTokenMint,
        1
      );
      assert.fail("Should fail when treasury has insufficient funds");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it.skip("TEST 6.4: User claiming profit from treasury vault with multiple strategy vaults", async () => {
    // Create a new depositor
    const depositor4 = anchor.web3.Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(depositor4.publicKey, 5 * 1e9);
    await provider.connection.confirmTransaction(airdropSig, "confirmed");
    
    // Get the ATA address first (don't create yet)
    const depositor4ATA = spl.getAssociatedTokenAddressSync(
      usdcTokenMint,
      depositor4.publicKey
    );

    console.log('--------------------------------');
    console.log("depositor4", depositor4.publicKey);
    console.log("mint", usdcTokenMint);
    console.log("depositor4ATA", depositor4ATA.toString());
    console.log('--------------------------------');
    
    // Now mint directly to this ATA
    await spl.mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor4ATA,
      newAdmin,
      200 * 10 ** 6
    );

    // Rest of the test remains the same...
    // Create a second strategy vault with risk level 2
    await client.createStrategy(
      newAdmin,
      usdcTokenMint,
      2
    );

    console.log("depositing with ", depositor4.publicKey.toBase58());
    // Deposit into both strategy vaults
    await client.userDeposit(
      depositor4,
      usdcTokenMint,
      1,
      50 * 10 ** 6
    );

    await client.userDeposit(
      depositor4,
      usdcTokenMint,
      2,
      75 * 10 ** 6
    );

    // Execute arbitrage on both vaults
    await client.executeArbitrageMock(
      ammWallet,
      usdcTokenMint,
      1,
      20 * 10 ** 6
    );

    await client.executeArbitrageMock(
      ammWallet,
      usdcTokenMint,
      2,
      30 * 10 ** 6
    );

    // Get balance before claims
    const balanceBefore = await spl.getAccount(provider.connection, depositor4ATA);

    // Claim profit from both vaults
    await client.claimProfit(
      depositor4,
      usdcTokenMint,
      1
    );

    await client.claimProfit(
      depositor4,
      usdcTokenMint,
      2
    );

    // Get balance after claims
    const balanceAfter = await spl.getAccount(provider.connection, depositor4ATA);

    // Verify that balance increased
    assert.isAbove(Number(balanceAfter.amount), Number(balanceBefore.amount));
});

  it("TEST 6.5: Users claiming profit from treasury vault from same strategy vault", async () => {
    // Create multiple depositors
    const depositor5a = anchor.web3.Keypair.generate();
    const depositor5b = anchor.web3.Keypair.generate();
    await client.airdrop([depositor5a.publicKey, depositor5b.publicKey], 5);
    
    const depositor5aATA = await client.getOrCreateATA(usdcTokenMint, depositor5a);
    const depositor5bATA = await client.getOrCreateATA(usdcTokenMint, depositor5b);
    
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor5aATA.address, 
      authority: newAdmin, 
      amount: 100 * 10 ** 6 
    });
    
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor5bATA.address, 
      authority: newAdmin, 
      amount: 100 * 10 ** 6 
    });

    // Both depositors deposit into the same vault
    await client.userDeposit({
      depositor: depositor5a,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 60 * 10 ** 6
    });

    await client.userDeposit({
      depositor: depositor5b,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 40 * 10 ** 6
    });

    // Execute arbitrage to generate profit
    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 50 * 10 ** 6
    });

    // Get balances before claims
    const balance5aBefore = await client.getAccount(depositor5aATA.address);
    const balance5bBefore = await client.getAccount(depositor5bATA.address);

    // Both users claim profit
    await client.claimProfit({
      depositor: depositor5a,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    await client.claimProfit({
      depositor: depositor5b,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    // Get balances after claims
    const balance5aAfter = await client.getAccount(depositor5aATA.address);
    const balance5bAfter = await client.getAccount(depositor5bATA.address);

    // Verify that both balances increased
    assert.isAbove(Number(balance5aAfter.amount), Number(balance5aBefore.amount));
    assert.isAbove(Number(balance5bAfter.amount), Number(balance5bBefore.amount));

    // Verify that depositor5a got more profit (60% vs 40% of deposits)
    const profit5a = Number(balance5aAfter.amount) - Number(balance5aBefore.amount);
    const profit5b = Number(balance5bAfter.amount) - Number(balance5bBefore.amount);
    assert.isAbove(profit5a, profit5b);
  });
});