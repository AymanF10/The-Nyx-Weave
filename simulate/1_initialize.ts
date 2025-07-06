import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { loadKeypair } from "./util";
import * as fs from 'fs';
import * as path from 'path';

interface AccountInfo {
    admin: string;
    administrators: string;
    globalConfig: string;
    treasuryVault: string;
    usdcMint: string;
    lastInitAdminTx: string;
    lastInitConfigTx: string;
}

interface InitStatus {
    adminInitialized: boolean;
    configInitialized: boolean;
    lastInitTimestamp: number;
}

async function main() {
    // Initialize connection to devnet
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Define paths for state files
    const accountInfoPath = path.join(__dirname, 'nyx_init_account_info.json');
    const initStatusPath = path.join(__dirname, 'nyx_init_status.json');
    
    let admin: Keypair;
    let deployer: Keypair;
    
    // Load keypairs
    try {
        // Load admin keypair (the one who will be added as administrator and control the program)
        admin = loadKeypair("./simulate/admin-keypair.json");
        // Load payer keypair (pays for account creation - can be any wallet with SOL)
        // This does NOT need to be the wallet that deployed the program
        deployer = loadKeypair("./Turbin3-wallet.json");
        
        console.log("Successfully loaded keypairs:");
        console.log("Admin (will control the program):", admin.publicKey.toBase58());
        console.log("Payer (pays for transactions):", deployer.publicKey.toBase58());
    } catch (error) {
        console.error("Failed to load keypairs:", error);
        console.error("Make sure you have the following files:");
        console.error("- ./simulate/admin-keypair.json");
        console.error("- ./Turbin3-wallet.json");
        process.exit(1);
    }

    // Create provider and client
    const wallet = new anchor.Wallet(deployer);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    console.log("Initializing Nyx-Weave client...");
    const client = new NyxWeaveClient(provider);

    // Check balances
    console.log("\n=== Checking Account Balances ===");
    const payerBalance = await connection.getBalance(deployer.publicKey);
    const adminBalance = await connection.getBalance(admin.publicKey);
    console.log(`Payer balance: ${payerBalance / 1e9} SOL`);
    console.log(`Admin balance: ${adminBalance / 1e9} SOL`);
    
    if (payerBalance < 0.1 * 1e9) {
        console.log("\nPayer account needs more SOL. Requesting airdrop...");
        try {
            const airdropSig = await connection.requestAirdrop(deployer.publicKey, 2 * 1e9);
            await connection.confirmTransaction(airdropSig, "confirmed");
            console.log("Airdrop successful for payer!");
        } catch (error) {
            console.log("Airdrop failed. Please run:");
            console.log(`solana airdrop 2 ${deployer.publicKey.toBase58()} --url devnet`);
        }
    }

    // Check initialization status
    let initStatus: InitStatus = { 
        adminInitialized: false, 
        configInitialized: false, 
        lastInitTimestamp: 0 
    };
    
    if (fs.existsSync(initStatusPath)) {
        initStatus = JSON.parse(fs.readFileSync(initStatusPath, 'utf8'));
        if (initStatus.adminInitialized && initStatus.configInitialized) {
            console.log("Program already fully initialized. Exiting...");
            console.log("To re-initialize, delete the following files:");
            console.log(`- ${initStatusPath}`);
            console.log(`- ${accountInfoPath}`);
            return;
        }
    }

    try {
        // Load existing account info if it exists
        let accountInfo: AccountInfo = {
            admin: admin.publicKey.toBase58(),
            administrators: "",
            globalConfig: "",
            treasuryVault: "",
            usdcMint: "",
            lastInitAdminTx: "",
            lastInitConfigTx: ""
        };

        if (fs.existsSync(accountInfoPath)) {
            const existingInfo = JSON.parse(fs.readFileSync(accountInfoPath, 'utf8'));
            accountInfo = { ...accountInfo, ...existingInfo };
            console.log("Loaded existing account info");
        }

        // Step 1: Initialize Administrators if not already done
        if (!initStatus.adminInitialized) {
            console.log("\n=== Step 1: Initializing Administrators ===");
            
            // Derive the administrators PDA
            const [administratorsPda, administratorsBump] = await client.getAdministratorsAddress();
            
            console.log("Administrators PDA:", administratorsPda.toBase58());
            console.log("Administrators Bump:", administratorsBump);
            
            // Check if administrators account already exists
            const administratorsExists = await client.accountExists(administratorsPda);
            
            if (!administratorsExists) {
                console.log("Creating administrators account...");
                console.log("Adding admin:", admin.publicKey.toBase58());
                console.log("Payer for this transaction:", deployer.publicKey.toBase58());
                
                try {
                    const initAdminTx = await client.initializeAdministrators(admin.publicKey);
                    
                    console.log("Administrators initialized successfully!");
                    console.log("Transaction signature:", initAdminTx);
                    
                    accountInfo.administrators = administratorsPda.toBase58();
                    accountInfo.lastInitAdminTx = initAdminTx;
                    initStatus.adminInitialized = true;
                    
                    // Save progress
                    fs.writeFileSync(accountInfoPath, JSON.stringify(accountInfo, null, 2));
                    fs.writeFileSync(initStatusPath, JSON.stringify(initStatus, null, 2));
                    
                    // Wait for confirmation
                    await connection.confirmTransaction(initAdminTx, "confirmed");
                    console.log("Transaction confirmed!");
                    
                    // Verify the account was created
                    try {
                        const adminAccount = await client.getAdministrators();
                        console.log("Administrators account created at:", adminAccount.address);
                        // The minimal client doesn't deserialize the full account data yet
                        // so we just confirm it exists
                    } catch (verifyError) {
                        console.log("Account created but couldn't verify contents (this is normal with the minimal client)");
                    }
                } catch (error) {
                    console.error("Failed to initialize administrators:", error);
                    throw error;
                }
            } else {
                console.log("Administrators account already exists");
                accountInfo.administrators = administratorsPda.toBase58();
                initStatus.adminInitialized = true;
                
                // Verify the admin is in the list
                try {
                    const adminAccount = await client.getAdministrators();
                    console.log("Administrators account exists at:", adminAccount.address);
                } catch (error) {
                    console.log("Couldn't fetch administrator details (this is normal)");
                }
            }
        }

        // Step 2: Create USDC mint if needed (for testing purposes)
        let usdcMint: PublicKey;
        if (!accountInfo.usdcMint) {
            console.log("\n=== Creating Test USDC Mint ===");
            
            // Check admin balance first
            const adminBalance = await connection.getBalance(admin.publicKey);
            console.log(`Admin balance: ${adminBalance / 1e9} SOL`);
            
            if (adminBalance < 0.01 * 1e9) {
                console.log("Admin account needs SOL for creating mint. Requesting airdrop...");
                try {
                    const airdropSig = await connection.requestAirdrop(admin.publicKey, 2 * 1e9);
                    await connection.confirmTransaction(airdropSig, "confirmed");
                    console.log("Airdrop successful!");
                } catch (airdropError) {
                    console.error("Airdrop failed. Please fund the admin account manually:");
                    console.error(`solana airdrop 2 ${admin.publicKey.toBase58()} --url devnet`);
                    throw new Error("Insufficient SOL for creating mint");
                }
            }
            
            const usdcMintKeypair = Keypair.generate();
            
            // Note: In production, you would use the actual USDC mint address
            // For devnet testing, we create our own mint
            try {
                usdcMint = await spl.createMint(
                    connection,
                    admin,
                    admin.publicKey,
                    null,
                    6, // 6 decimals for USDC
                    usdcMintKeypair
                );
                
                console.log("Created test USDC mint:", usdcMint.toBase58());
                accountInfo.usdcMint = usdcMint.toBase58();
                fs.writeFileSync(accountInfoPath, JSON.stringify(accountInfo, null, 2));
            } catch (mintError) {
                console.error("Failed to create mint:", mintError);
                throw mintError;
            }
        } else {
            console.log("Using existing USDC mint:", accountInfo.usdcMint);
            usdcMint = new PublicKey(accountInfo.usdcMint);
        }

        // Step 3: Initialize Config and Treasury if not already done
        if (!initStatus.configInitialized) {
            console.log("\n=== Step 2: Initializing Config and Treasury ===");
            
            // Derive PDAs
            const [globalConfigPda, globalConfigBump] = await client.getGlobalConfigAddress();
            const [treasuryVaultPda, treasuryVaultBump] = await client.getTreasuryVaultAddress();
            const [administratorsPda] = await client.getAdministratorsAddress();
            
            console.log("Global Config PDA:", globalConfigPda.toBase58());
            console.log("Global Config Bump:", globalConfigBump);
            console.log("Treasury Vault PDA:", treasuryVaultPda.toBase58());
            console.log("Treasury Vault Bump:", treasuryVaultBump);
            
            // Check if global config already exists
            const globalConfigExists = await client.accountExists(globalConfigPda);
            
            if (!globalConfigExists) {
                console.log("Creating global config and treasury vault...");
                
                // Initialize with parameters
                const feeBps = 100; // 1% fee (100 basis points)
                const minProfitThreshold = 1000000; // 1 USDC (with 6 decimals)
                const maxRetries = 3;
                
                console.log("\nInitialization Parameters:");
                console.log("- Fee BPS:", feeBps, "(1%)");
                console.log("- Min Profit Threshold:", minProfitThreshold / 1000000, "USDC");
                console.log("- Max Retries:", maxRetries);
                
                try {
                    const initConfigTx = await client.initializeConfigTreasury(
                        admin,
                        feeBps,
                        minProfitThreshold,
                        maxRetries
                    );
                    
                    console.log("\nConfig and Treasury initialized successfully!");
                    console.log("Transaction signature:", initConfigTx);
                    
                    accountInfo.globalConfig = globalConfigPda.toBase58();
                    accountInfo.treasuryVault = treasuryVaultPda.toBase58();
                    accountInfo.lastInitConfigTx = initConfigTx;
                    initStatus.configInitialized = true;
                    
                    // Save final state
                    fs.writeFileSync(accountInfoPath, JSON.stringify(accountInfo, null, 2));
                    fs.writeFileSync(initStatusPath, JSON.stringify(initStatus, null, 2));
                    
                    // Wait for confirmation
                    await connection.confirmTransaction(initConfigTx, "confirmed");
                    console.log("Transaction confirmed!");
                    
                    // Verify the accounts were created
                    try {
                        const globalConfig = await client.getGlobalConfig();
                        const treasuryVault = await client.getTreasuryVault();
                        
                        console.log("\nGlobal Config:");
                        console.log("- Address:", globalConfig.address);
                        console.log("- Admin:", globalConfig.admin || "N/A");
                        console.log("- Fee BPS:", globalConfig.feeBps || feeBps);
                        
                        console.log("\nTreasury Vault:");
                        console.log("- Address:", treasuryVault.address);
                    } catch (verifyError) {
                        console.log("\nAccounts created successfully!");
                        console.log("(Full details not available with minimal client)");
                    }
                } catch (error) {
                    console.error("Failed to initialize config and treasury:", error);
                    throw error;
                }
            } else {
                console.log("Global config already exists");
                accountInfo.globalConfig = globalConfigPda.toBase58();
                accountInfo.treasuryVault = treasuryVaultPda.toBase58();
                initStatus.configInitialized = true;
                
                // Display current config
                try {
                    const globalConfig = await client.getGlobalConfig();
                    console.log("\nCurrent Global Config:");
                    console.log("- Address:", globalConfig.address);
                    console.log("- Admin:", globalConfig.admin || "N/A");
                    console.log("- Fee BPS:", globalConfig.feeBps || "N/A");
                } catch (error) {
                    console.log("\nGlobal config exists but couldn't fetch details");
                }
            }
        }

        // Final status update
        initStatus.lastInitTimestamp = Date.now();
        fs.writeFileSync(initStatusPath, JSON.stringify(initStatus, null, 2));

        console.log("\n=== Setup Completed Successfully! ===");
        console.log("Account information saved to:", accountInfoPath);
        console.log("Initialization status saved to:", initStatusPath);
        
        // Display all important addresses
        console.log("\n=== Important Addresses ===");
        console.log("Program ID:", client.programId.toBase58());
        console.log("Administrators PDA:", accountInfo.administrators);
        console.log("Global Config PDA:", accountInfo.globalConfig);
        console.log("Treasury Vault PDA:", accountInfo.treasuryVault);
        console.log("Test USDC Mint:", accountInfo.usdcMint);
        
        console.log("\n=== Next Steps ===");
        console.log("1. Create a strategy using the create_strategy instruction");
        console.log("2. Users can then deposit into the strategy");
        console.log("3. The strategy can be delegated for trading");

    } catch (error) {
        console.error("Error during setup:", error);
        console.log("Last saved state can be found in:", accountInfoPath);
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