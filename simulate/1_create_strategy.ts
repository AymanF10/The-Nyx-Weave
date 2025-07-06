import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { loadKeypair, formatTokenAmount } from "./util";
import * as fs from 'fs';
import * as path from 'path';

interface ProgramState {
  admin: string;
  administrators: string;
  globalConfig: string;
  treasuryVault: string;
  usdcMint: string;
  strategyVaults: { [key: string]: string }; // riskLevel -> PDA
  depositors: { [key: string]: any };
  ammWallets: { [key: string]: string };
  users: { [key: string]: any };
  lastUpdate: number;
}

async function main() {
  console.log("🏦 Creating Strategy Vaults...");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load keypairs
  const admin = loadKeypair("./simulate/admin-keypair.json");
  const deployer = loadKeypair("./simulate/deployer-keypair.json");
  
  // Create provider and client
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const client = new NyxWeaveClient(provider);
  
  // Load state
  const statePath = path.join(__dirname, 'nyx_state.json');
  let state: ProgramState;
  
  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    console.log("📂 Loaded existing state");
  } else {
    console.error("❌ No state file found. Run 0_setup_devnet.ts first.");
    process.exit(1);
  }

  const usdcMint = new PublicKey(state.usdcMint);
  console.log("USDC Mint:", usdcMint.toBase58());

  // Check required accounts for createStrategy instruction
  console.log("\n🔍 Checking required accounts for createStrategy instruction...");
  
  // Get PDA addresses
  const [administratorsPda] = await client.getAdministratorsAddress();
  const [globalConfigPda] = await client.getGlobalConfigAddress();
  const [treasuryVaultPda] = await client.getTreasuryVaultAddress();
  
  // Check each required account
  const accountsToCheck = [
    { name: "Admin", address: admin.publicKey, required: true },
    { name: "Administrators PDA", address: administratorsPda, required: true },
    { name: "Global Config PDA", address: globalConfigPda, required: true },
    { name: "USDC Mint", address: usdcMint, required: true },
    { name: "Treasury Vault PDA", address: treasuryVaultPda, required: true },
  ];
  
  for (const account of accountsToCheck) {
    const exists = await client.accountExists(account.address);
    const status = exists ? "✅ EXISTS" : "❌ MISSING";
    console.log(`${status} ${account.name}: ${account.address.toBase58()}`);
  }
  
  // Check if treasury vault exists in state
  if (state.treasuryVault) {
    const treasuryExists = await client.accountExists(new PublicKey(state.treasuryVault));
    console.log(`${treasuryExists ? "✅ EXISTS" : "❌ MISSING"} Treasury Vault (from state): ${state.treasuryVault}`);
  } else {
    console.log("⚠️ Treasury Vault not found in state");
  }

  // Create strategy vaults for different risk levels
  const riskLevels = [1, 2, 3];
  
  for (const riskLevel of riskLevels) {
    const vaultKey = `risk_${riskLevel}`;
    
    console.log(`\n🏗️ Processing strategy vault for risk level ${riskLevel}...`);
    
    try {
      // Calculate PDA address
      const [strategyVaultPda] = await client.getStrategyVaultAddress(usdcMint, riskLevel);
      console.log(`📍 Calculated PDA for risk level ${riskLevel}:`, strategyVaultPda.toBase58());
      
      // Check if vault already exists in state
      if (state.strategyVaults[vaultKey]) {
        console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists in state:`, state.strategyVaults[vaultKey]);
        // Continue to check on-chain existence and attempt creation for debugging
      }
      
      // Check if vault exists on-chain
      const strategyVaultExists = await client.accountExists(strategyVaultPda);
      
      if (strategyVaultExists) {
        console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists on-chain`);
        if (!state.strategyVaults[vaultKey]) {
          state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
        }
      } else {
        console.log(`🔄 Attempting to create strategy vault for risk level ${riskLevel}...`);
        
        // Check associated token accounts that would be created
        const strategyVaultTokenAccount = await anchor.utils.token.associatedAddress({
          mint: usdcMint,
          owner: strategyVaultPda
        });
        
        const treasuryVaultTokenAccount = await anchor.utils.token.associatedAddress({
          mint: usdcMint,
          owner: treasuryVaultPda
        });
        
        console.log(`📍 Strategy vault token account: ${strategyVaultTokenAccount.toBase58()}`);
        console.log(`📍 Treasury vault token account: ${treasuryVaultTokenAccount.toBase58()}`);
        
        // Check if these token accounts exist
        const strategyTokenExists = await client.accountExists(strategyVaultTokenAccount);
        const treasuryTokenExists = await client.accountExists(treasuryVaultTokenAccount);
        console.log(`📍 Strategy vault token account exists: ${strategyTokenExists}`);
        console.log(`📍 Treasury vault token account exists: ${treasuryTokenExists}`);
        
        try {
          const createStrategyTx = await client.createStrategy(
            admin,
            usdcMint,
            riskLevel
          );
          console.log(`✅ Strategy vault created successfully:`, createStrategyTx);
          state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
        } catch (createError) {
          console.error(`❌ Failed to create strategy vault for risk level ${riskLevel}:`, createError);
          console.log(`⚠️ Storing PDA address anyway for future reference:`, strategyVaultPda.toBase58());
          state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
        }
      }
      
      // Verify the vault was created (if it should exist)
      try {
        const vaultData = await client.getStrategyVault(usdcMint, riskLevel);
        console.log(`📊 Vault verification:`, {
          address: vaultData.address,
          exists: vaultData.exists
        });
      } catch (verifyError) {
        console.log(`ℹ️ Vault verification failed (may not exist yet):`, verifyError.message);
      }
      
    } catch (error) {
      console.error(`❌ Failed to process strategy vault for risk level ${riskLevel}:`, error);
    }
  }

  // Save updated state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  
  console.log("\n🎉 Strategy vault processing complete!");
  console.log("📊 PDA addresses calculated:", Object.keys(state.strategyVaults).length);
  console.log("📁 State saved to:", statePath);
  
  // Display summary
  console.log("\n📋 Strategy Vault Summary:");
  for (const [key, address] of Object.entries(state.strategyVaults)) {
    console.log(`  ${key}: ${address}`);
  }
}

main().catch(console.error); 