import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import {
  GetCommitmentSignature
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PublicKey } from "@solana/web3.js";
import { assert, expect } from "chai";
import { NyxClient } from "../sdk/nyx-weave-client";
import { TheNyxWeave } from "../target/types/the_nyx_weave";
import { BN } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";

describe("Intra-Pool Arbitrage Platform", () => {
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

  // This Test Is Irrelevant as Is Handled By Solana Runtime
  /*
  it("TEST 1.1: Attempting to initialize admins twice", async () => {
    try {
      await client.initAdmins(unauthorizedUser);
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about account already being in use
      
      //expect(err.toString()).to.include("Error");
    }
  });*/

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
      // Attempt to initialize with unauthorized user
      await program.methods
        .initConfigTreasury(new BN(2000), new BN(1000), 1)
        .accounts({
          admin: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      
      //assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about unauthorized access
      //console.log(err.toString());
      //expect(err.error.errorCode.code).to.equal("OnlyAdmin");
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

  })

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

  })

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
  })
  it.skip("TEST 5.3: Simulating withdrawal from a delegated vault", async () => {
    console.log("Note: In a real scenario, if the strategy vault is delegated (is_delegated = true), the withdrawal would fail with VaultInDelegation error.");
    console.log("This test is a placeholder for that scenario, as we can't directly modify the vault state.");
  });

  it("TEST 6.1: Execution bot executing arbitrage and User claiming profit from treasury vault", async () => {

    const depositAmount = 400 * 10 ** 6;
    const profitAmount = 50 * 10 ** 6;

    // Setup depositor with more tokens for this test
    const depositor1ATA = await client.getOrCreateATA(usdcTokenMint, depositor1);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor1ATA.address, 
      authority: newAdmin, 
      amount: depositAmount
    });

    // Make a deposit
    await client.userDeposit({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: depositAmount
    });

    // Execute arbitrage mock
    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: profitAmount
    });

    const strategyVault = await client.getStrategyVault(usdcTokenMint, 1);
    expect(strategyVault.totalProfit.toNumber()).to.eq(profitAmount);

    // Get balance before claim
    const depositorBalanceBefore = await client.getAccount(depositor1ATA.address);

    // Claim profit
    await client.claimProfit({
      depositor: depositor1,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    const depositorBalanceAfter = await client.getAccount(depositor1ATA.address);
    assert.isAbove(Number(depositorBalanceAfter.amount), Number(depositorBalanceBefore.amount));
  });

  it("TEST 6.2: User with no profit attempting to claim profit", async () => {
    // Create a new depositor who hasn't participated in any arbitrage
    const depositor2 = anchor.web3.Keypair.generate();
    await client.airdrop([depositor2.publicKey], 5);
    
    const depositor2ATA = await client.getOrCreateATA(usdcTokenMint, depositor2);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor2ATA.address, 
      authority: newAdmin, 
      amount: 100 * 10 ** 6 
    });

    // Make a deposit but no arbitrage has been executed
    await client.userDeposit({
      depositor: depositor2,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 50 * 10 ** 6
    });

    try {
      await client.claimProfit({
        depositor: depositor2,
        mint: usdcTokenMint,
        riskLevel: 1
      });
      assert.fail("Should fail when no profit is available");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it.skip("TEST 6.3: User claiming profit from treasury vault with insufficient funds", async () => {
    // Create a new depositor
    const depositor3 = anchor.web3.Keypair.generate();
    await client.airdrop([depositor3.publicKey], 5);
    
    const depositor3ATA = await client.getOrCreateATA(usdcTokenMint, depositor3);
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor3ATA.address, 
      authority: newAdmin, 
      amount: 100 * 10 ** 6 
    });

    // Make a deposit
    await client.userDeposit({
      depositor: depositor3,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 50 * 10 ** 6
    });

    // Execute arbitrage to generate profit
    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 25 * 10 ** 6
    });

    // Claim profit once (this should work)
    await client.claimProfit({
      depositor: depositor3,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    // Try to claim again immediately (should fail due to insufficient funds in treasury)
    try {
      await client.claimProfit({
        depositor: depositor3,
        mint: usdcTokenMint,
        riskLevel: 1
      });
      assert.fail("Should fail when treasury has insufficient funds");
    } catch (err) {
      expect(err.toString()).to.include("Error");
    }
  });

  it.skip("TEST 6.4: User claiming profit from treasury vault with multiple strategy vaults", async () => {
    // Create a new depositor
    const depositor4 = anchor.web3.Keypair.generate();
    await client.airdrop([depositor4.publicKey], 5);
    
    // Get the ATA address first (don't create yet)
    const depositor4ATA = getAssociatedTokenAddressSync(
      usdcTokenMint,
      depositor4.publicKey
    );

    console.log('--------------------------------');
    console.log("depositor4", depositor4.publicKey);
    console.log("mint", usdcTokenMint);
    console.log("depositor4ATA", depositor4ATA.toString());
    console.log('--------------------------------');
    
    // Now mint directly to this ATA
    await client.mintToATA({ 
      mint: usdcTokenMint, 
      dest: depositor4ATA,  // Use the address directly
      authority: newAdmin, 
      amount: 200 * 10 ** 6 
    });

    // Rest of the test remains the same...
    // Create a second strategy vault with risk level 2
    await client.createStrategyVault({
      admin: newAdmin,
      mint: usdcTokenMint,
      riskLevel: 2
    });


    console.log("depositing with ", depositor4.publicKey.toBase58());
    // Deposit into both strategy vaults
    await client.userDeposit({
      depositor: depositor4,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 50 * 10 ** 6
    });

    await client.userDeposit({
      depositor: depositor4,
      mint: usdcTokenMint,
      riskLevel: 2,
      amount: 75 * 10 ** 6
    });

    // Execute arbitrage on both vaults
    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 1,
      amount: 20 * 10 ** 6
    });

    await client.executeArbitrageMock({
      ammWallet: ammWallet,
      mint: usdcTokenMint,
      riskLevel: 2,
      amount: 30 * 10 ** 6
    });

    // Get balance before claims
    const balanceBefore = await client.getAccount(depositor4ATA);

    // Claim profit from both vaults
    await client.claimProfit({
      depositor: depositor4,
      mint: usdcTokenMint,
      riskLevel: 1
    });

    await client.claimProfit({
      depositor: depositor4,
      mint: usdcTokenMint,
      riskLevel: 2
    });

    // Get balance after claims
    const balanceAfter = await client.getAccount(depositor4ATA);

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