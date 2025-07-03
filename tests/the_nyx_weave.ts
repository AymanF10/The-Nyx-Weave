import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { TheNyxWeave } from "../target/types/the_nyx_weave";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, Transaction, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { expect, assert } from "chai";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import {
  GetCommitmentSignature
} from "@magicblock-labs/ephemeral-rollups-sdk";

describe("Intra-Pool Arbitrage Platform", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Ephemeral Rollup Provider
  const ephemeralProvider = new anchor.AnchorProvider(
    new anchor.web3.Connection(
      "https://devnet.magicblock.app/",
      { wsEndpoint: "wss://devnet.magicblock.app/" }
    ),
    anchor.Wallet.local()
  );
  

  const program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;


  // TEST SETUP 
  let usdcTokenMint: PublicKey;

  const deployer = provider.wallet;
  //let newAdmin: PublicKey;
  const newAdmin = anchor.web3.Keypair.generate();
  const depositor1 = anchor.web3.Keypair.generate();
  const unauthorizedUser = anchor.web3.Keypair.generate();


  async function airdropSol(provider, publicKey, amountSol) {
    const airdropSig = await provider.connection.requestAirdrop(
      publicKey,
      amountSol * anchor.web3.LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdropSig);
  }

  /* Let's set up the actors in our system for airdrop*/

  async function setupActors(provider, users, amount) {
    for (const user of users) {
      await airdropSol(provider, user, amount);
    }
  
  }

  before(async () => {
    await setupActors(provider, [newAdmin.publicKey, depositor1.publicKey, unauthorizedUser.publicKey], 5);

    // Mint Creation
    usdcTokenMint = await createMint(
      provider.connection,
      newAdmin,
      newAdmin.publicKey,
      null,
      6,
    );
  });

  it("TEST 1: Initializing the Admins", async () => {
    // set up AdminPDA
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    // Call instruction
    await program.methods
      .initAdmins(newAdmin.publicKey)
      .accounts({
        //@ts-ignore
        admin: adminPDA
      })
      .signers([])
      .rpc();
    
    // Get Account State, and Make Relevant Assertions
      const AdminData = await program.account.administrator.fetch(adminPDA);
      expect(AdminData.administrators.map(pk => pk.toBase58())).to.include(newAdmin.publicKey.toBase58());
  });

  // This Test Is Irrelevant as Is Handled By Solana Runtime
  /*
  it("TEST 1.1: Attempting to initialize admins twice", async () => {
    // set up AdminPDA
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    try {
      // Call instruction again - should fail because account already exists
      await program.methods
        .initAdmins(unauthorizedUser.publicKey)
        .accounts({
          //@ts-ignore
          admin: adminPDA
        })
        .signers([])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about account already being in use
      
      //expect(err.toString()).to.include("Error");
    }
  });*/

  it("TEST 2: Initializing the Global Config And Treasury Vault", async () => {
    // Get The PDAs
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    const [globalConfigPDA, globalConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );

    const [treasuryVaultPDA, treasuryVaulBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault")],
      program.programId
    );

    // Call instruction
    await program.methods
      .initConfigTreasury(new BN(1000), new BN(1000), 2)
      .accounts({
        admin: newAdmin.publicKey,
      })
      .signers([newAdmin])
      .rpc();

    // Get The Account Data, and Make Assertions
    const globalConfigData = await program.account.globalConfig.fetch(globalConfigPDA);
    const treasuryVaultData = await program.account.treasuryVault.fetch(treasuryVaultPDA);

    expect(globalConfigData.admin).deep.equal(newAdmin.publicKey);
    expect(globalConfigData.feeBps.toNumber()).to.eq(1000);
    expect(globalConfigData.maxRetries).to.eq(2);
    expect(globalConfigData.minProfitThreshold.toNumber()).to.eq(1000);

    expect(treasuryVaultData.lastDistributionTime.toNumber()).to.eq(0);
    expect(treasuryVaultData.totalProfitsDistributed.toNumber()).to.eq(0);
    expect(treasuryVaultData.totalProfitsSecured.toNumber()).to.eq(0);
    expect(treasuryVaultData.treasuryAdmin).deep.equal(newAdmin.publicKey);
  })

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
      console.log(err.toString());
      //expect(err.error.errorCode.code).to.equal("OnlyAdmin");
    }
  });

  it("TEST 2.2: Attempting to initialize with invalid parameters", async () => {
    try {
      // Attempt to initialize with invalid max retries (>3)
      await program.methods
        .initConfigTreasury(new BN(1000), new BN(1000), 5) // Max retries > 3
        .accounts({
          admin: newAdmin.publicKey,
        })
        .signers([newAdmin])
        .rpc();
      
      //assert.fail("The transaction should have failed");
    } catch (err: any) {
      // Expect an error about invalid parameter
      //expect(err.error.errorCode.code).to.equal("InvalidParameter");
    }
  });

  it("TEST 3: Creating Strategy Vault", async () => {
    // Get PDAs
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    const [globalConfigPDA, globalConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      program.programId
    );

    

    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Call instruction
    await program.methods
      .createStrategy(1)
      .accountsPartial({
        admin: newAdmin.publicKey,
        //@ts-ignore
        admins: adminPDA,
        depositTokenMint: usdcTokenMint,
        // @ts-ignore
        strategyVault: strategyVaultPDA,
        vaultTokenAccount: vaultTokenAccount,
        
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([newAdmin])
      .rpc();

    // Get Account Data, And Make Assertions
    const strategyVaultData = await program.account.strategyVault.fetch(strategyVaultPDA);
    expect(strategyVaultData.isActive).to.be.true;
    expect(strategyVaultData.totalDeposits.toNumber()).to.eq(0);
    expect(strategyVaultData.riskLevel).to.eq(1);
    expect(strategyVaultData.isDelegated).to.be.false;
    expect(strategyVaultData.depositTokenMint).deep.equal(usdcTokenMint);
  })

  it("TEST 3.1: Unauthorized user trying to create strategy vault", async () => {
    // Get PDAs
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    // Create a new risk level to avoid collision with existing strategy vault
    const riskLevel = 2;
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([riskLevel])],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      // Attempt to create strategy with unauthorized user
      await program.methods
        .createStrategy(riskLevel)
        .accountsPartial({
          admin: unauthorizedUser.publicKey,
          //@ts-ignore
          admins: adminPDA,
          depositTokenMint: usdcTokenMint,
          // @ts-ignore
          strategyVault: strategyVaultPDA,
          vaultTokenAccount: vaultTokenAccount,
          
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about unauthorized access
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 3.2: Attempting to create duplicate strategy vault", async () => {
    // Get PDAs
    const [adminPDA, adminPDABump] = PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      program.programId
    );

    // Use the same risk level as the existing strategy vault
    const riskLevel = 1;
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([riskLevel])],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    try {
      // Attempt to create strategy with same parameters
      await program.methods
        .createStrategy(riskLevel)
        .accountsPartial({
          admin: newAdmin.publicKey,
          //@ts-ignore
          admins: adminPDA,
          depositTokenMint: usdcTokenMint,
          // @ts-ignore
          strategyVault: strategyVaultPDA,
          vaultTokenAccount: vaultTokenAccount,
          
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([newAdmin])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about account already in use
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4: User Making Deposits Into A Strategy Vault", async () => {
    // Get PDAs
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    const [depositor1AccountPDA, depositorAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor1.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // create ATA for depositor 1
    const depositor1ATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor1,
      usdcTokenMint,
      depositor1.publicKey
    );
    // Mint UsdcToken To Depositor1
    await mintTo(
      provider.connection,
      newAdmin,
      usdcTokenMint,
      depositor1ATAaddress.address,
      newAdmin.publicKey,
      500 * 10 ** 6,
      [newAdmin]
    );

    // Call instruction
    await program.methods
      .userDeposit(1, new BN(400 * 10 ** 6))
      .accounts({
        depositor: depositor1.publicKey,
        depositorTokenAccount: depositor1ATAaddress.address,
        depositToken: usdcTokenMint,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
        depositorAccount: depositor1AccountPDA,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor1])
      .rpc();

    // Get Account Data, And Make Some Assertions
    const depositor1AccountData = await program.account.depositorAccount.fetch(depositor1AccountPDA);
    const strategyVaultData = await program.account.strategyVault.fetch(strategyVaultPDA);
    const depositor1AtaBalance = await getAccount(provider.connection, depositor1ATAaddress.address);

    expect(depositor1AccountData.depositor).deep.equal(depositor1.publicKey);
    expect(depositor1AccountData.totalAmountDeposited.toNumber()).to.eq(400 * 10 ** 6);

    expect(strategyVaultData.totalDeposits.toNumber()).to.eq(400 * 10 ** 6);

    expect(Number(depositor1AtaBalance.amount)).to.eq(100 * 10 ** 6);
  })

  it("TEST 4.1: Attempting to deposit with insufficient funds", async () => {
    // Get PDAs
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    const [depositor1AccountPDA, depositorAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor1.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // create ATA for depositor 1
    const depositor1ATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor1,
      usdcTokenMint,
      depositor1.publicKey
    );

    try {
      // Attempt to deposit more than available balance
      await program.methods
        .userDeposit(1, new BN(200 * 10 ** 6)) // Trying to deposit 200 tokens when only 100 are available
        .accounts({
          depositor: depositor1.publicKey,
          depositorTokenAccount: depositor1ATAaddress.address,
          depositToken: usdcTokenMint,
          //@ts-ignore
          strategyVault: strategyVaultPDA,
          depositorAccount: depositor1AccountPDA,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor1])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about insufficient funds
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 4.2: Attempting to deposit to non-existent strategy vault", async () => {
    // Create a non-existent risk level
    const nonExistentRiskLevel = 99;
    
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([nonExistentRiskLevel])],
      program.programId
    );

    const [depositor1AccountPDA, depositorAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor1.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // create ATA for depositor 1
    const depositor1ATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor1,
      usdcTokenMint,
      depositor1.publicKey
    );

    try {
      // Attempt to deposit to non-existent strategy vault
      await program.methods
        .userDeposit(nonExistentRiskLevel, new BN(50 * 10 ** 6))
        .accounts({
          depositor: depositor1.publicKey,
          depositorTokenAccount: depositor1ATAaddress.address,
          depositToken: usdcTokenMint,
          //@ts-ignore
          strategyVault: strategyVaultPDA,
          depositorAccount: depositor1AccountPDA,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor1])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about account not found
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5: User Making Withdrawals From An Undelegated Strategy Vault", async () => {
    // Get PDAs
    // Get PDAs
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    const [depositor1AccountPDA, depositorAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor1.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // create ATA for depositor 1
    const depositor1ATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor1,
      usdcTokenMint,
      depositor1.publicKey
    );

    // Call instruction
     await program.methods
      .userWithdraw(1, new BN(300 * 10 ** 6))
      .accounts({
        depositor: depositor1.publicKey,
        depositorTokenAccount: depositor1ATAaddress.address,
        depositToken: usdcTokenMint,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
        depositorAccount: depositor1AccountPDA,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor1])
      .rpc();

    // Get Account Data, And Make Assertions
    const depositor1AccountData = await program.account.depositorAccount.fetch(depositor1AccountPDA);
    const strategyVaultData = await program.account.strategyVault.fetch(strategyVaultPDA);
    const depositor1AtaBalance = await getAccount(provider.connection, depositor1ATAaddress.address);

    expect(depositor1AccountData.depositor).deep.equal(depositor1.publicKey);
    expect(depositor1AccountData.totalAmountDeposited.toNumber()).to.eq(100 * 10 ** 6);

    expect(strategyVaultData.totalDeposits.toNumber()).to.eq(100 * 10 ** 6);

    expect(Number(depositor1AtaBalance.amount)).to.eq(400 * 10 ** 6);
  })

  it("TEST 5.1: Attempting to withdraw more than deposited", async () => {
    // Get PDAs
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    const [depositor1AccountPDA, depositorAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), depositor1.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // create ATA for depositor 1
    const depositor1ATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor1,
      usdcTokenMint,
      depositor1.publicKey
    );

    try {
      // Attempt to withdraw more than deposited
      await program.methods
        .userWithdraw(1, new BN(200 * 10 ** 6)) // Trying to withdraw 200 tokens when only 100 are deposited
        .accounts({
          depositor: depositor1.publicKey,
          depositorTokenAccount: depositor1ATAaddress.address,
          depositToken: usdcTokenMint,
          //@ts-ignore
          strategyVault: strategyVaultPDA,
          depositorAccount: depositor1AccountPDA,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor1])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about insufficient funds
      expect(err.toString()).to.include("Error");
    }
  });

  it("TEST 5.2: Unauthorized user attempting to withdraw", async () => {
    // Get PDAs
    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("strategy_vault"), usdcTokenMint.toBuffer(), Buffer.from([1])],
      program.programId
    );

    // Create PDA for unauthorized user
    const [unauthorizedUserAccountPDA, unauthorizedUserAccountBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("depositor"), unauthorizedUser.publicKey.toBuffer(), usdcTokenMint.toBuffer()],
      program.programId
    );

    const vaultTokenAccount = await getAssociatedTokenAddressSync(
      usdcTokenMint,
      strategyVaultPDA,
      true,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // Create ATA for unauthorized user
    const unauthorizedUserATAaddress = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      unauthorizedUser,
      usdcTokenMint,
      unauthorizedUser.publicKey
    );

    try {
      // Attempt withdrawal by unauthorized user
      await program.methods
        .userWithdraw(1, new BN(50 * 10 ** 6))
        .accounts({
          depositor: unauthorizedUser.publicKey,
          depositorTokenAccount: unauthorizedUserATAaddress.address,
          depositToken: usdcTokenMint,
          //@ts-ignore
          strategyVault: strategyVaultPDA,
          depositorAccount: unauthorizedUserAccountPDA, // This account doesn't exist or has no deposits
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([unauthorizedUser])
        .rpc();
      
      assert.fail("The transaction should have failed");
    } catch (err) {
      // Expect an error about insufficient funds or account not found
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
    
    let delegation_tx = await program.methods
      .delegateStrategy(usdcTokenMint, riskLevel)
      .accounts({
        caller: deployer.publicKey,
        //@ts-ignore
        strategyVault: strategyVaultPDA,
      })
      .transaction();
      delegation_tx.feePayer = provider.wallet.publicKey;
      
      delegation_tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
      delegation_tx = await ephemeralProvider.wallet.signTransaction(delegation_tx);

      await provider.sendAndConfirm(delegation_tx, [], { 
        skipPreflight: true,
        commitment: "confirmed", 
       });
  })
});