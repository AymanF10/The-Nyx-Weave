import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
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
  strategyVaults: { [key: string]: string };
  depositors: { [key: string]: DepositorInfo };
  ammWallets: { [key: string]: string };
  lastUpdate: number;
}

interface DepositorInfo {
  pubkey: string;
  ata: string;
  deposits: { [key: string]: number };
  lastDeposit: number;
}

interface BalanceInfo {
  sol: number;
  tokens: { [mint: string]: number };
}

async function main() {
  console.log("💎 Profit Claiming Simulation...");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load keypairs
  const deployer = loadKeypair("./simulate/deployer-keypair.json");
  const depositor = loadKeypair("./simulate/depositor-keypair.json");
  
  console.log("Depositor:", depositor.publicKey.toBase58());
  
  // Create provider and client
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  const client = new NyxWeaveClient(provider);
  
  // Load state
  const statePath = path.join(__dirname, 'nyx_state.json');
  const balancesPath = path.join(__dirname, 'balances.json');
  
  let state: ProgramState;
  let balances: { [key: string]: BalanceInfo };
  
  if (fs.existsSync(statePath)) {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    console.log("📂 Loaded existing state");
  } else {
    console.error("❌ No state file found. Run 0_setup_devnet.ts first.");
    process.exit(1);
  }
  
  if (fs.existsSync(balancesPath)) {
    balances = JSON.parse(fs.readFileSync(balancesPath, 'utf8'));
  } else {
    balances = {};
  }

  const usdcMint = new PublicKey(state.usdcMint);
  const depositorInfo = state.depositors[depositor.publicKey.toBase58()];
  
  if (!depositorInfo) {
    console.error("❌ No deposits found for this depositor. Run 2_deposit.ts first.");
    process.exit(1);
  }
  
  // Get current balance before claiming
  const depositorATA = spl.getAssociatedTokenAddressSync(usdcMint, depositor.publicKey);
  const balanceBefore = await spl.getAccount(connection, depositorATA);
  console.log("💰 Balance before claiming:", formatTokenAmount(Number(balanceBefore.amount)));
  
  // Claim profits from different risk levels
  const riskLevels = [1, 2, 3];
  
  for (const riskLevel of riskLevels) {
    const vaultKey = `risk_${riskLevel}`;
    const strategyVaultPDA = state.strategyVaults[vaultKey];
    
    if (!strategyVaultPDA) {
      console.log(`❌ Strategy vault for risk level ${riskLevel} not found`);
      continue;
    }
    
    // Check if depositor has deposits in this vault
    const currentDeposit = depositorInfo.deposits[strategyVaultPDA] || 0;
    if (currentDeposit === 0) {
      console.log(`⚠️ No deposits found for risk level ${riskLevel}`);
      continue;
    }
    
    console.log(`\n💎 Claiming profits from risk level ${riskLevel}...`);
    console.log(`📊 Current deposit: ${formatTokenAmount(currentDeposit)}`);
    
    try {
      await client.claimProfit(
        depositor,
        usdcMint,
        riskLevel
      );
      
      console.log(`✅ Profit claimed successfully from vault:`, strategyVaultPDA);
      
      // Get updated balance
      const balanceAfter = await spl.getAccount(connection, depositorATA);
      const profitEarned = Number(balanceAfter.amount) - Number(balanceBefore.amount);
      
      console.log(`💰 Profit earned: ${formatTokenAmount(profitEarned)}`);
      console.log(`💰 New balance: ${formatTokenAmount(Number(balanceAfter.amount))}`);
      
      // Update balances in state
      balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] = Number(balanceAfter.amount) / 10 ** 6;
      
      console.log(`✅ Profit claimed successfully from vault:`, strategyVaultPDA);
      
    } catch (error) {
      console.error(`❌ Profit claiming failed for risk level ${riskLevel}:`, error);
    }
  }
  
  // Update SOL balance
  const finalSolBalance = await connection.getBalance(depositor.publicKey);
  balances[depositor.publicKey.toBase58()].sol = finalSolBalance / 1e9;
  
  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Profit claiming complete!");
  console.log("📊 Final balances:");
  console.log("- SOL:", formatTokenAmount(balances[depositor.publicKey.toBase58()].sol, 9));
  console.log("- USDC:", formatTokenAmount(balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] || 0));
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
}

main().catch(console.error); 