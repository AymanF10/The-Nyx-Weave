import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { TheNyxWeave } from "../target/types/the_nyx_weave";
import * as anchor from "@coral-xyz/anchor";

export interface NyxClientConfig {
  provider: AnchorProvider;
  programId: PublicKey;
}

export class NyxClient {
  readonly provider: AnchorProvider;
  readonly program: Program<TheNyxWeave>;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;
  }

  async getProgramId(): Promise<PublicKey> {
    return this.program.programId;
  }

  async airdrop(pubkeys: PublicKey[], solAmount = 1) {
    for (const pk of pubkeys) {
      const sig = await this.provider.connection.requestAirdrop(pk, solAmount * web3.LAMPORTS_PER_SOL);
      await this.provider.connection.confirmTransaction(sig, "confirmed");
    }
  }

    // Helper to derive PDA addresses
    async getAdministratorsAddress(): Promise<[PublicKey, number]> {
      return PublicKey.findProgramAddressSync(
        [Buffer.from("administrators")],
        this.program.programId
      );
    }
  
    async getGlobalConfigAddress(): Promise<[PublicKey, number]> {
      return PublicKey.findProgramAddressSync(
        [Buffer.from("global_config")],
        this.program.programId
      );
    }
  
    async getTreasuryVaultAddress(): Promise<[PublicKey, number]> {
      return PublicKey.findProgramAddressSync(
        [Buffer.from("treasury_vault")],
        this.program.programId
      );
    }

      // Check if an account exists
  async accountExists(address: PublicKey): Promise<boolean> {
    const accountInfo = await this.provider.connection.getAccountInfo(address);
    return accountInfo !== null;
  }

  // Fetch raw account data
  async getRawAccountData(address: PublicKey): Promise<Buffer | null> {
    const accountInfo = await this.provider.connection.getAccountInfo(address);
    return accountInfo ? accountInfo.data : null;
  }

  // Simple account fetch methods that return the raw data
  async getAdministrators(): Promise<any> {
    const [administratorsPda] = await this.getAdministratorsAddress();
    const data = await this.getRawAccountData(administratorsPda);
    if (!data) throw new Error("Administrators account not found");
    
    // For now, just return that the account exists
    // You can add proper deserialization later
    return { exists: true, address: administratorsPda.toBase58() };
  }

  async getTreasuryVault(): Promise<any> {
    const [treasuryVaultPda] = await this.getTreasuryVaultAddress();
    const data = await this.getRawAccountData(treasuryVaultPda);
    if (!data) throw new Error("Treasury vault account not found");
    
    return { exists: true, address: treasuryVaultPda.toBase58() };
  }

async createMint({ authority }: { authority: Keypair }): Promise<PublicKey> {
  if (!authority || !authority.publicKey) {
    throw new Error("Authority Keypair is required for mint creation");
  }
  return await createMint(this.provider.connection, authority, authority.publicKey, null, 6);

}

  async getOrCreateATA(mint: PublicKey, owner: Keypair) {
    return await getOrCreateAssociatedTokenAccount(
      this.provider.connection,
      owner,
      mint,
      owner.publicKey
    );
  }

  async getAccount(address: PublicKey) {
    return await getAccount(this.provider.connection, address);
  }

  async mintToATA({ mint, dest, authority, amount }: { mint: PublicKey; dest: PublicKey; authority: Keypair; amount: number; }) {
    await mintTo(this.provider.connection, authority, mint, dest, authority.publicKey, amount, [authority]);
  }

  async initAdmins(admin: PublicKey) {
    const [adminPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("administrators")
    ], this.program.programId);

    return await this.program.methods
      .initAdmins(admin)
      .accountsPartial({ admin: adminPDA })
      .rpc();
  }

  async getAdmins(): Promise<string[]> {
    const [adminPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("administrators")
    ], this.program.programId);
    const adminData = await this.program.account.administrator.fetch(adminPDA);
    return adminData.administrators.map((k: PublicKey) => k.toBase58());
  }

  async initGlobalConfig({ admin, feeBps, minProfitThreshold, maxRetries }: { admin: Keypair; feeBps: number; minProfitThreshold: number; maxRetries: number; }) {
    return await this.program.methods
      .initConfigTreasury(new BN(feeBps), new BN(minProfitThreshold), maxRetries)
      .accounts({
        admin: admin.publicKey
      })
      .signers([admin])
      .rpc();
  }

  async getGlobalConfig() {
    const [pda] = PublicKey.findProgramAddressSync([
      Buffer.from("global_config")
    ], this.program.programId);
    return await this.program.account.globalConfig.fetch(pda);
  }

  async createStrategyVault({ admin, mint, riskLevel }: { admin: Keypair; mint: PublicKey; riskLevel: number; }) {
    // Get all PDAs with bumps
    const [adminPDA, adminBump] = PublicKey.findProgramAddressSync([
      Buffer.from("administrators")
    ], this.program.programId);

    const [strategyVaultPDA, strategyVaultBump] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    const [treasuryVaultPDA, treasuryVaultBump] = await this.getTreasuryVaultAddress();
    const [globalConfigPDA, globalConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      this.program.programId
    );

    // Get associated token accounts - MUST use same token program everywhere
    const strategyVaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      strategyVaultPDA,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID // Must match Anchor program
    );

    const treasuryVaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      treasuryVaultPDA,
      true, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID // Must match Anchor program
    );

    console.log("Accounts being used:", {
      admin: admin.publicKey.toString(),
      admins: adminPDA.toString(),
      globalConfig: globalConfigPDA.toString(),
      depositTokenMint: mint.toString(),
      strategyVault: strategyVaultPDA.toString(),
      strategyVaultTokenAccount: strategyVaultTokenAccount.toString(),
      treasuryVault: treasuryVaultPDA.toString(),
      treasuryVaultTokenAccount: treasuryVaultTokenAccount.toString()
    });

    try {
      const tx = await this.program.methods
        .createStrategy(riskLevel)
        .accountsStrict({
          admin: admin.publicKey,
          admins: adminPDA,
          globalConfig: globalConfigPDA,
          depositTokenMint: mint,
          strategyVault: strategyVaultPDA,
          strategyVaultTokenAccount,
          treasuryVault: treasuryVaultPDA,
          treasuryVaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      console.log("Transaction successful:", tx);
      return tx;
    } catch (error) {
      console.error("Error creating strategy vault:", error);
      if (error.logs) {
        console.error("Transaction logs:", error.logs);
      }
      throw error;
    }
}
  async getStrategyVault(mint: PublicKey, riskLevel: number) {
    const [strategyVaultPDA] = await this.getStrategyVaultAddress(mint, riskLevel);
    return await this.program.account.strategyVault.fetch(strategyVaultPDA);
  }

  async getStrategyVaultAddress(mint: PublicKey, riskLevel: number) {
    return PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);
  }

  async userDeposit({ depositor, mint, riskLevel, amount }: { depositor: Keypair; mint: PublicKey; riskLevel: number; amount: number; }) {
    
    console.log("depositing inside client with depositor ", depositor.publicKey.toBase58());

    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    const [depositorPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("depositor"),
      depositor.publicKey.toBuffer(),
      mint.toBuffer(),
      strategyVaultPDA.toBuffer()
    ], this.program.programId);


    const depositorATA = getAssociatedTokenAddressSync(mint, depositor.publicKey);
    // console.log("depositing into strategy vault......")
    // console.log("depositor", depositor.publicKey);
    // // console.log("mint", mint);
    // // console.log("riskLevel", riskLevel);
    // // console.log("depositorATA", depositorATA);
    const vaultTokenAccount = getAssociatedTokenAddressSync(mint, strategyVaultPDA, true);

    await this.program.methods
      .userDeposit(riskLevel, new BN(amount))
      .accountsPartial({
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorATA,
        depositToken: mint,
        strategyVault: strategyVaultPDA,
        depositorAccount: depositorPDA,
        vaultTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([depositor])
      .rpc();
  }

  async userWithdraw({ depositor, mint, riskLevel, amount }: { depositor: Keypair; mint: PublicKey; riskLevel: number; amount: number; }) {
    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    const [depositorPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("depositor"),
      depositor.publicKey.toBuffer(),
      mint.toBuffer(),
      strategyVaultPDA.toBuffer()
    ], this.program.programId);

    const depositorATA = getAssociatedTokenAddressSync(mint, depositor.publicKey);
    const vaultTokenAccount = getAssociatedTokenAddressSync(mint, strategyVaultPDA, true);

    await this.program.methods
      .userWithdraw(riskLevel, new BN(amount))
      .accountsPartial({
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorATA,
        depositToken: mint,
        strategyVault: strategyVaultPDA,
        depositorAccount: depositorPDA,
        vaultTokenAccount,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId
      })
      .signers([depositor])
      .rpc();
  }

  async getDepositorAccount(depositor: PublicKey, mint: PublicKey, strategyVault: PublicKey) {
    const [depositorPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("depositor"),
      depositor.toBuffer(),
      mint.toBuffer(),
      strategyVault.toBuffer()
    ], this.program.programId);
    return await this.program.account.depositorAccount.fetch(depositorPDA);
  }

  async executeArbitrageMock({ 
    ammWallet, 
    mint, 
    riskLevel, 
    amount 
  }: { 
    ammWallet: Keypair; 
    mint: PublicKey; 
    riskLevel: number; 
    amount: number; 
  }) {
    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    const [treasuryVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("treasury_vault")
    ], this.program.programId);

    const ammWalletATA = getAssociatedTokenAddressSync(mint, ammWallet.publicKey);
    const strategyVaultATA = getAssociatedTokenAddressSync(mint, strategyVaultPDA, true);
    const treasuryVaultATA = getAssociatedTokenAddressSync(mint, treasuryVaultPDA, true);

    await this.program.methods
      .executeArbitrageMock(riskLevel, new BN(amount))
      .accountsPartial({
        ammWallet: ammWallet.publicKey,
        ammWalletTokenAccount: ammWalletATA,
        strategyVaultTokenAccount: strategyVaultATA,
        treasuryVaultTokenAccount: treasuryVaultATA,
        profitToken: mint,
        strategyVault: strategyVaultPDA,
        treasuryVault: treasuryVaultPDA,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ammWallet])
      .rpc();
  }

  async createTokenAccountIfNotExists({
    mint,
    owner,
    tokenAccount
  }: {
    mint: PublicKey;
    owner: PublicKey;
    tokenAccount: PublicKey;
  }) {
    try {
      const accountInfo = await this.provider.connection.getAccountInfo(tokenAccount);
      if (!accountInfo) {
        const tx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            this.provider.wallet.publicKey,
            tokenAccount,
            owner,
            mint
          )
        );
        await this.provider.sendAndConfirm(tx);
      }
    } catch (error) {
      console.error("Error creating token account:", error);
      throw error;
    }
  }

  async claimProfit({ 
    depositor, 
    mint, 
    riskLevel 
  }: { 
    depositor: Keypair; 
    mint: PublicKey; 
    riskLevel: number; 
  }) {
    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    const [treasuryVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("treasury_vault")
    ], this.program.programId);

    const [globalConfigPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("global_config")
    ], this.program.programId);

    const [depositorPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("depositor"),
      depositor.publicKey.toBuffer(),
      mint.toBuffer(),
      strategyVaultPDA.toBuffer()
    ], this.program.programId);

    const depositorATA = getAssociatedTokenAddressSync(mint, depositor.publicKey);
    const treasuryVaultATA = getAssociatedTokenAddressSync(mint, treasuryVaultPDA, true);
    const strategyVaultATA = getAssociatedTokenAddressSync(mint, strategyVaultPDA, true);

    await this.program.methods
      .claimProfit(riskLevel)
      .accountsPartial({
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorATA,
        depositToken: mint,
        strategyVault: strategyVaultPDA,
        treasuryVault: treasuryVaultPDA,
        depositorAccount: depositorPDA,
        treasuryVaultTokenAccount: treasuryVaultATA,
        strategyVaultTokenAccount: strategyVaultATA,
        globalConfig: globalConfigPDA,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();
  }
}
