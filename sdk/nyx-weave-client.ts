import { AnchorProvider, BN, Program, web3 } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TheNyxWeave } from "../target/types/the_nyx_weave";
import * as anchor from "@coral-xyz/anchor";

export interface NyxClientConfig {
  provider: AnchorProvider;
  programId: PublicKey;
}

export class NyxClient {
  readonly provider: AnchorProvider;
  readonly program: Program<TheNyxWeave>;

  static async init(config: NyxClientConfig): Promise<NyxClient> {
    const idl = await Program.fetchIdl<TheNyxWeave>(config.programId, config.provider);
    if (!idl) throw new Error("Unable to fetch IDL for NyxWeave");
    const program = new Program(idl, config.programId, config.provider);
    return new NyxClient(config.provider);
  }

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = anchor.workspace.the_nyx_weave as Program<TheNyxWeave>;
  }

  async airdrop(pubkeys: PublicKey[], solAmount = 1) {
    for (const pk of pubkeys) {
      const sig = await this.provider.connection.requestAirdrop(pk, solAmount * web3.LAMPORTS_PER_SOL);
      await this.provider.connection.confirmTransaction(sig, "confirmed");
    }
  }

  async createMint({ authority }: { authority: Keypair }): Promise<PublicKey> {
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

  async initAdmins(admin: Keypair) {
    const [adminPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("administrators")
    ], this.program.programId);

    await this.program.methods
      .initAdmins(admin.publicKey)
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
    await this.program.methods
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
    const [adminPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("administrators")
    ], this.program.programId);

    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);

    await this.program.methods
      .createStrategy(riskLevel)
      .accountsPartial({
        admin: admin.publicKey,
        admins: adminPDA,
        depositTokenMint: mint,
        strategyVault: strategyVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  }

  async getStrategyVault(mint: PublicKey, riskLevel: number) {
    const [strategyVaultPDA] = PublicKey.findProgramAddressSync([
      Buffer.from("strategy_vault"),
      mint.toBuffer(),
      Buffer.from([riskLevel])
    ], this.program.programId);
    return await this.program.account.strategyVault.fetch(strategyVaultPDA);
  }

  async userDeposit({ depositor, mint, riskLevel, amount }: { depositor: Keypair; mint: PublicKey; riskLevel: number; amount: number; }) {
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
      .userDeposit(riskLevel, new BN(amount))
      .accountsPartial({
        depositor: depositor.publicKey,
        depositorTokenAccount: depositorATA,
        depositToken: mint,
        strategyVault: strategyVaultPDA,
        depositorAccount: depositorPDA,
        vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
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
        tokenProgram: TOKEN_PROGRAM_ID,
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
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([ammWallet])
      .rpc();
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

    console.log("depositorATA", depositorATA);
    console.log("treasuryVaultATA", treasuryVaultATA);
    console.log("strategyVaultATA", strategyVaultATA);
    console.log("depositorPDA", depositorPDA);
    console.log("globalConfigPDA", globalConfigPDA);
    console.log("strategyVaultPDA", strategyVaultPDA);
    console.log("treasuryVaultPDA", treasuryVaultPDA);
    console.log("depositor", depositor.publicKey);
    console.log("mint", mint);
    console.log("riskLevel", riskLevel);
    console.log("depositor", depositor.publicKey);
    
    await this.program.methods
      .claimProfit()
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
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();
  }
}
