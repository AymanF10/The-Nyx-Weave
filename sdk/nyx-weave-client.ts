import * as anchor from "@coral-xyz/anchor";
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

export class NyxWeaveClient {
  private provider: anchor.AnchorProvider;
  public programId: PublicKey;
  private idl: any;

  constructor(provider: anchor.AnchorProvider) {
    this.provider = provider;
    
    // Load IDL from file
    const idlPath = path.join(__dirname, "../idl/the_nyx_weave.json");
    const idlString = fs.readFileSync(idlPath, "utf8");
    this.idl = JSON.parse(idlString);
    
    // Set program ID - using the address from your IDL
    this.programId = new PublicKey("9mPXPz9nnih8hbFBtNgsiVnysE1RD1ciUDkucwLmafAz");
    
    console.log("Provider wallet:", this.provider.wallet.publicKey.toBase58());
    console.log("Program ID:", this.programId.toBase58());
  }

  // Helper to derive PDA addresses
  async getAdministratorsAddress(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("administrators")],
      this.programId
    );
  }

  async getGlobalConfigAddress(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      this.programId
    );
  }

  async getTreasuryVaultAddress(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("treasury_vault")],
      this.programId
    );
  }

  async getStrategyVaultAddress(depositTokenMint: PublicKey, riskLevel: number): Promise<[PublicKey, number]> {
    // Convert risk level to big-endian bytes (8 bytes)
    const riskLevelBytes = Buffer.alloc(8);
    riskLevelBytes.writeBigUInt64BE(BigInt(riskLevel));
    
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("strategy_vault"),
        depositTokenMint.toBuffer(),
        riskLevelBytes
      ],
      this.programId
    );
  }

  // Initialize administrators using raw transaction
  async initializeAdministrators(adminPubkey: PublicKey): Promise<string> {
    const [administratorsPda] = await this.getAdministratorsAddress();
    
    // Create the instruction manually
    const discriminator = Buffer.from([167, 72, 158, 202, 115, 142, 106, 3]); // initAdmins discriminator from IDL
    const data = Buffer.concat([
      discriminator,
      adminPubkey.toBuffer()
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: this.provider.wallet.publicKey, isSigner: true, isWritable: true }, // deployer
        { pubkey: administratorsPda, isSigner: false, isWritable: true }, // admin
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: this.programId,
      data: data
    });

    const transaction = new Transaction().add(instruction);
    
    if (!this.provider.wallet.payer) {
      throw new Error("Provider wallet payer is undefined");
    }
    const signature = await sendAndConfirmTransaction(
      this.provider.connection,
      transaction,
      [this.provider.wallet.payer],
      { commitment: 'confirmed' }
    );
    
    console.log("Administrators initialized:", signature);
    return signature;
  }

  // Initialize config and treasury using raw transaction
  async initializeConfigTreasury(
    admin: Keypair,
    feeBps: number,
    minProfitThreshold: number,
    maxRetries: number
  ): Promise<string> {
    const [administratorsPda] = await this.getAdministratorsAddress();
    const [globalConfigPda] = await this.getGlobalConfigAddress();
    const [treasuryVaultPda] = await this.getTreasuryVaultAddress();
    
    // Create the instruction manually
    const discriminator = Buffer.from([223, 132, 83, 208, 12, 175, 209, 166]); // initConfigTreasury discriminator
    
    // Encode the arguments
    const feeBpsBuffer = new anchor.BN(feeBps).toArrayLike(Buffer, 'le', 8);
    const minProfitThresholdBuffer = new anchor.BN(minProfitThreshold).toArrayLike(Buffer, 'le', 8);
    const maxRetriesBuffer = Buffer.from([maxRetries]);
    
    const data = Buffer.concat([
      discriminator,
      feeBpsBuffer,
      minProfitThresholdBuffer,
      maxRetriesBuffer
    ]);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // admin
        { pubkey: administratorsPda, isSigner: false, isWritable: true }, // administrators
        { pubkey: globalConfigPda, isSigner: false, isWritable: true }, // globalConfig
        { pubkey: treasuryVaultPda, isSigner: false, isWritable: true }, // treasuryVault
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
      ],
      programId: this.programId,
      data: data
    });

    const transaction = new Transaction().add(instruction);
    
    const signature = await sendAndConfirmTransaction(
      this.provider.connection,
      transaction,
      [admin],
      { commitment: 'confirmed' }
    );
    
    console.log("Config and Treasury initialized:", signature);
    return signature;
  }

  // Create strategy using raw transaction
  async createStrategy(
    admin: Keypair,
    depositTokenMint: PublicKey,
    riskLevel: number
  ): Promise<string> {
    const [administratorsPda] = await this.getAdministratorsAddress();
    const [globalConfigPda] = await this.getGlobalConfigAddress();
    const [strategyVaultPda] = await this.getStrategyVaultAddress(depositTokenMint, riskLevel);
    const [treasuryVaultPda] = await this.getTreasuryVaultAddress();
    
    // Get vault token accounts
    const strategyVaultTokenAccount = await spl.getAssociatedTokenAddress(
      depositTokenMint,
      strategyVaultPda,
      true
    );
    
    const treasuryVaultTokenAccount = await spl.getAssociatedTokenAddress(
      depositTokenMint,
      treasuryVaultPda,
      true
    );

    // Create the instruction manually
    const discriminator = Buffer.from([152, 160, 107, 148, 245, 190, 127, 224]); // createStrategy discriminator
    const riskLevelBuffer = Buffer.from([riskLevel]);
    
    const data = Buffer.concat([
      discriminator,
      riskLevelBuffer
    ]);

    // For TokenInterface, we should use Token-2022 program
    // even if the mint is created with the standard token program
    const tokenProgramId = TOKEN_2022_PROGRAM_ID;
    console.log("Using Token-2022 program for TokenInterface:", tokenProgramId.toBase58());

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true }, // admin
        { pubkey: administratorsPda, isSigner: false, isWritable: true }, // admins
        { pubkey: globalConfigPda, isSigner: false, isWritable: false }, // globalConfig
        { pubkey: depositTokenMint, isSigner: false, isWritable: false }, // depositTokenMint
        { pubkey: strategyVaultPda, isSigner: false, isWritable: true }, // strategyVault
        { pubkey: strategyVaultTokenAccount, isSigner: false, isWritable: true }, // strategyVaultTokenAccount
        { pubkey: treasuryVaultPda, isSigner: false, isWritable: false }, // treasuryVault
        { pubkey: treasuryVaultTokenAccount, isSigner: false, isWritable: true }, // treasuryVaultTokenAccount
        { pubkey: tokenProgramId, isSigner: false, isWritable: false }, // tokenProgram - use correct program
        { pubkey: spl.ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associatedTokenProgram
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
      ],
      programId: this.programId,
      data: data
    });

    const transaction = new Transaction().add(instruction);
    
    const signature = await sendAndConfirmTransaction(
      this.provider.connection,
      transaction,
      [admin],
      { commitment: 'confirmed' }
    );
    
    console.log("Strategy created:", signature);
    return signature;
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

  async getGlobalConfig(): Promise<any> {
    const [globalConfigPda] = await this.getGlobalConfigAddress();
    const data = await this.getRawAccountData(globalConfigPda);
    if (!data) throw new Error("Global config account not found");
    
    // Basic parsing - skip discriminator (8 bytes) and read some fields
    const discriminator = data.slice(0, 8);
    const feeBps = new anchor.BN(data.slice(8, 16), 'le');
    const admin = new PublicKey(data.slice(16, 48));
    
    return {
      exists: true,
      address: globalConfigPda.toBase58(),
      feeBps: feeBps.toNumber(),
      admin: admin.toBase58()
    };
  }

  async getTreasuryVault(): Promise<any> {
    const [treasuryVaultPda] = await this.getTreasuryVaultAddress();
    const data = await this.getRawAccountData(treasuryVaultPda);
    if (!data) throw new Error("Treasury vault account not found");
    
    return { exists: true, address: treasuryVaultPda.toBase58() };
  }

  async getStrategyVault(depositTokenMint: PublicKey, riskLevel: number): Promise<any> {
    const [strategyVaultPda] = await this.getStrategyVaultAddress(depositTokenMint, riskLevel);
    const data = await this.getRawAccountData(strategyVaultPda);
    if (!data) throw new Error("Strategy vault account not found");
    
    return { exists: true, address: strategyVaultPda.toBase58() };
  }
}