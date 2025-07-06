import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { loadKeypair } from "./util";
import * as fs from 'fs';
import * as path from 'path';

interface DepositConfig {
    admin: string;
    administrators: string;
    globalConfig: string;
    treasuryVault: string;
    usdcMint: string;
    strategyVault?: string;
    depositor?: string;
    depositorAccount?: string;
}

async function main() {
    // Initialize connection to devnet (or localnet if you prefer)
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Define paths for state files
    const configPath = path.join(__dirname, 'nyx_init_account_info.json');
    const depositConfigPath = path.join(__dirname, 'deposit_config.json');
    
    // Load initialization config
    if (!fs.existsSync(configPath)) {
        console.error("Initialization config not found. Please run 1_initialize.ts first!");
        process.exit(1);
    }
    
    const initConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log("Loaded initialization config");
    
    let admin: Keypair;
    let depositor: Keypair;
    let payer: Keypair;
    
    // Load keypairs
    try {
        // Admin keypair (needed to create strategy if not exists)
        admin = loadKeypair("./simulate/admin-keypair.json");
        
        // Depositor keypair (the user who will deposit)
        // You can use a different keypair or create a new one
        depositor = loadKeypair("./simulate/depositor-keypair.json");
        
        // Payer keypair (pays for transactions)
        payer = loadKeypair("./Turbin3-wallet.json");
        
        console.log("Successfully loaded keypairs:");
        console.log("Admin:", admin.publicKey.toBase58());
        console.log("Depositor:", depositor.publicKey.toBase58());
        console.log("Payer:", payer.publicKey.toBase58());
    } catch (error) {
        console.error("Failed to load keypairs:", error);
        console.log("\nTo create a depositor keypair:");
        console.log("solana-keygen new -o ./simulate/depositor-keypair.json");
        process.exit(1);
    }
    
    // Create provider and client
    const wallet = new anchor.Wallet(payer);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);
    
    console.log("\nInitializing Nyx-Weave client...");
    const client = new NyxWeaveClient(provider);
    
    // Load or initialize deposit config
    let depositConfig: DepositConfig = {
        ...initConfig,
        depositor: depositor.publicKey.toBase58()
    };
    
    if (fs.existsSync(depositConfigPath)) {
        const existingConfig = JSON.parse(fs.readFileSync(depositConfigPath, 'utf8'));
        depositConfig = { ...depositConfig, ...existingConfig };
        console.log("Loaded existing deposit config");
    }
    
    try {
        // Check balances
        console.log("\n=== Checking Balances ===");
        const depositorBalance = await connection.getBalance(depositor.publicKey);
        console.log(`Depositor SOL balance: ${depositorBalance / 1e9} SOL`);
        
        if (depositorBalance < 0.01 * 1e9) {
            console.log("Depositor needs SOL. Requesting airdrop...");
            try {
                const sig = await connection.requestAirdrop(depositor.publicKey, 2 * 1e9);
                await connection.confirmTransaction(sig, "confirmed");
                console.log("Airdrop successful!");
            } catch (e) {
                console.log("Airdrop failed. Please fund manually:");
                console.log(`solana airdrop 2 ${depositor.publicKey.toBase58()} --url devnet`);
            }
        }
        
        const usdcMint = new PublicKey(depositConfig.usdcMint);
        
        // Check if depositor has USDC token account
        const depositorUsdcAta = await spl.getAssociatedTokenAddress(
            usdcMint,
            depositor.publicKey
        );
        
        let depositorUsdcBalance = 0;
        try {
            const tokenAccount = await spl.getAccount(connection, depositorUsdcAta);
            depositorUsdcBalance = Number(tokenAccount.amount) / 1e6; // 6 decimals for USDC
            console.log(`Depositor USDC balance: ${depositorUsdcBalance} USDC`);
        } catch (error) {
            console.log("Depositor USDC account not found. Will create and mint...");
        }
        
        // Mint USDC to depositor if needed
        if (depositorUsdcBalance < 100) {
            console.log("\n=== Minting USDC to Depositor ===");
            
            // Create ATA if doesn't exist
            try {
                await spl.getAccount(connection, depositorUsdcAta);
            } catch {
                console.log("Creating depositor USDC account...");
                await spl.createAssociatedTokenAccount(
                    connection,
                    admin, // payer
                    usdcMint,
                    depositor.publicKey
                );
            }
            
            // Mint 1000 USDC
            const mintAmount = 1000 * 1e6; // 1000 USDC with 6 decimals
            console.log("Minting 1000 USDC to depositor...");
            
            const mintTx = await spl.mintTo(
                connection,
                admin, // mint authority
                usdcMint,
                depositorUsdcAta,
                admin,
                mintAmount
            );
            
            console.log("Mint transaction:", mintTx);
            
            // Check new balance
            const newTokenAccount = await spl.getAccount(connection, depositorUsdcAta);
            depositorUsdcBalance = Number(newTokenAccount.amount) / 1e6;
            console.log(`New depositor USDC balance: ${depositorUsdcBalance} USDC`);
        }
        
        // Step 1: Create strategy if not exists
        const riskLevel = 1; // Low risk strategy
        
        // Note: Your code uses to_be_bytes() for risk_level in seeds
        const riskLevelBytes = Buffer.alloc(8);
        riskLevelBytes.writeBigUInt64BE(BigInt(riskLevel));
        
        const [strategyVaultPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("strategy_vault"),
                usdcMint.toBuffer(),
                riskLevelBytes
            ],
            client.programId
        );
        
        const strategyExists = await client.accountExists(strategyVaultPda);
        
        if (!strategyExists) {
            console.log("\n=== Creating Strategy Vault ===");
            console.log("Risk Level:", riskLevel);
            console.log("Token:", usdcMint.toBase58());
            
            try {
                const createStrategyTx = await client.createStrategy(
                    admin,
                    usdcMint,
                    riskLevel
                );
                
                console.log("Strategy created:", createStrategyTx);
                depositConfig.strategyVault = strategyVaultPda.toBase58();
                fs.writeFileSync(depositConfigPath, JSON.stringify(depositConfig, null, 2));
                
                // Wait for confirmation
                await connection.confirmTransaction(createStrategyTx, "confirmed");
            } catch (error) {
                console.error("Failed to create strategy:", error);
                throw error;
            }
        } else {
            console.log("\n=== Strategy Already Exists ===");
            console.log("Strategy Vault:", strategyVaultPda.toBase58());
            depositConfig.strategyVault = strategyVaultPda.toBase58();
        }
        
        // Step 2: Make a deposit
        console.log("\n=== Making Deposit ===");
        const depositAmount = 100 * 1e6; // 100 USDC
        console.log(`Depositing ${depositAmount / 1e6} USDC...`);
        
        // Derive depositor account PDA
        const [depositorAccountPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("depositor"),
                depositor.publicKey.toBuffer(),
                usdcMint.toBuffer(),
                strategyVaultPda.toBuffer()
            ],
            client.programId
        );
        
        // Create deposit instruction manually
        const discriminator = Buffer.from([186, 198, 140, 233, 129, 39, 98, 153]); // userDeposit discriminator
        const riskLevelBuffer = Buffer.from([riskLevel]);
        const amountBuffer = new anchor.BN(depositAmount).toArrayLike(Buffer, 'le', 8);
        
        const data = Buffer.concat([
            discriminator,
            riskLevelBuffer,
            amountBuffer
        ]);
        
        // Get vault token account
        const vaultTokenAccount = await spl.getAssociatedTokenAddress(
            usdcMint,
            strategyVaultPda,
            true
        );
        
        // Check which token program to use
        let tokenProgramId = spl.TOKEN_PROGRAM_ID;
        try {
            const mintInfo = await connection.getAccountInfo(usdcMint);
            if (mintInfo && mintInfo.owner.equals(spl.TOKEN_2022_PROGRAM_ID)) {
                tokenProgramId = spl.TOKEN_2022_PROGRAM_ID;
            }
        } catch (e) {
            console.log("Using default TOKEN_PROGRAM_ID");
        }
        
        const { Transaction, TransactionInstruction, sendAndConfirmTransaction } = await import("@solana/web3.js");
        
        const instruction = new TransactionInstruction({
            keys: [
                { pubkey: depositor.publicKey, isSigner: true, isWritable: true }, // depositor
                { pubkey: usdcMint, isSigner: false, isWritable: false }, // depositToken
                { pubkey: depositorUsdcAta, isSigner: false, isWritable: true }, // depositorTokenAccount
                { pubkey: depositorAccountPda, isSigner: false, isWritable: true }, // depositorAccount
                { pubkey: strategyVaultPda, isSigner: false, isWritable: true }, // strategyVault
                { pubkey: vaultTokenAccount, isSigner: false, isWritable: true }, // vaultTokenAccount
                { pubkey: tokenProgramId, isSigner: false, isWritable: false }, // tokenProgram - use correct program
                { pubkey: spl.ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associatedTokenProgram
                { pubkey: anchor.web3.SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
            ],
            programId: client.programId,
            data: data
        });
        
        const transaction = new Transaction().add(instruction);
        
        console.log("Sending deposit transaction...");
        const depositTx = await sendAndConfirmTransaction(
            connection,
            transaction,
            [depositor],
            { commitment: 'confirmed' }
        );
        
        console.log("Deposit successful!", depositTx);
        depositConfig.depositorAccount = depositorAccountPda.toBase58();
        fs.writeFileSync(depositConfigPath, JSON.stringify(depositConfig, null, 2));
        
        // Check final balances
        console.log("\n=== Final Balances ===");
        const finalTokenAccount = await spl.getAccount(connection, depositorUsdcAta);
        const finalBalance = Number(finalTokenAccount.amount) / 1e6;
        console.log(`Depositor USDC balance: ${finalBalance} USDC`);
        
        try {
            const vaultAccount = await spl.getAccount(connection, vaultTokenAccount);
            const vaultBalance = Number(vaultAccount.amount) / 1e6;
            console.log(`Strategy Vault USDC balance: ${vaultBalance} USDC`);
        } catch (e) {
            console.log("Could not fetch vault balance");
        }
        
        // Display summary
        console.log("\n=== Deposit Summary ===");
        console.log("Depositor:", depositor.publicKey.toBase58());
        console.log("Amount Deposited:", depositAmount / 1e6, "USDC");
        console.log("Strategy Vault:", strategyVaultPda.toBase58());
        console.log("Risk Level:", riskLevel);
        console.log("Depositor Account PDA:", depositorAccountPda.toBase58());
        
        console.log("\n✅ Deposit simulation completed successfully!");
        console.log("Configuration saved to:", depositConfigPath);
        
    } catch (error) {
        console.error("Error during deposit simulation:", error);
        console.log("Last saved state can be found in:", depositConfigPath);
        process.exit(1);
    }
}

main().then(
    () => process.exit(0),
    (err) => {
        console.error(err);
        process.exit(1);
    }
);