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

  // Create strategy vaults for different risk levels
  const riskLevels = [1, 2, 3];
  
  for (const riskLevel of riskLevels) {
    const vaultKey = `risk_${riskLevel}`;
    
    if (state.strategyVaults[vaultKey]) {
      console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists:`, state.strategyVaults[vaultKey]);
      continue;
    }

    console.log(`\n🏗️ Creating strategy vault for risk level ${riskLevel}...`);
    
    try {
      const [strategyVaultPda] = await client.getStrategyVaultAddress(usdcMint, riskLevel);
      const strategyVaultExists = await client.accountExists(strategyVaultPda);
      
      if (!strategyVaultExists) {
        const createStrategyTx = await client.createStrategy(
          admin,
          usdcMint,
          riskLevel
        );
        console.log(`✅ Strategy vault created:`, createStrategyTx);
      } else {
        console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists`);
      }
      
      state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
      
      // Verify the vault was created
      const vaultData = await client.getStrategyVault(usdcMint, riskLevel);
      console.log(`📊 Vault data:`, {
        address: vaultData.address,
        exists: vaultData.exists
      });
      
    } catch (error) {
      console.error(`❌ Failed to create strategy vault for risk level ${riskLevel}:`, error);
    }
  }

  // Save updated state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  
  console.log("\n🎉 Strategy vault creation complete!");
  console.log("📊 Created vaults:", Object.keys(state.strategyVaults).length);
  console.log("📁 State saved to:", statePath);
}

main().catch(console.error); 