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
  console.log("💸 User Withdrawal Simulation...");
  
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
  
  console.log("📊 Current deposits:", Object.keys(depositorInfo.deposits).length);
  
  // Get current balances
  const depositorATA = spl.getAssociatedTokenAddressSync(usdcMint, depositor.publicKey);
  const currentBalance = await spl.getAccount(connection, depositorATA);
  console.log("💰 Current USDC balance:", formatTokenAmount(Number(currentBalance.amount)));
  
  // Withdraw from different risk levels
  const withdrawalAmounts = {
    1: 500 * 10 ** 6,  // 500 USDC
    2: 1000 * 10 ** 6, // 1k USDC
    3: 750 * 10 ** 6   // 750 USDC
  };
  
  for (const [riskLevel, amount] of Object.entries(withdrawalAmounts)) {
    const vaultKey = `risk_${riskLevel}`;
    const strategyVaultPDA = state.strategyVaults[vaultKey];
    
    if (!strategyVaultPDA) {
      console.log(`❌ Strategy vault for risk level ${riskLevel} not found`);
      continue;
    }
    
    const currentDeposit = depositorInfo.deposits[strategyVaultPDA] || 0;
    if (currentDeposit < amount) {
      console.log(`⚠️ Insufficient deposit for risk level ${riskLevel}. Available: ${formatTokenAmount(currentDeposit)}, Requested: ${formatTokenAmount(amount)}`);
      continue;
    }
    
    console.log(`\n💸 Withdrawing ${formatTokenAmount(amount)} USDC from risk level ${riskLevel}...`);
    
    try {
      await client.userWithdraw(
        depositor,
        usdcMint,
        parseInt(riskLevel),
        amount
      );
      
      // Update state
      state.depositors[depositor.publicKey.toBase58()].deposits[strategyVaultPDA] = currentDeposit - amount;
      
      console.log(`✅ Withdrawal successful from vault:`, strategyVaultPDA);
      
      // Get updated balances
      const newBalance = await spl.getAccount(connection, depositorATA);
      balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] = Number(newBalance.amount) / 10 ** 6;
      
      console.log(`✅ Withdrawal successful from vault:`, strategyVaultPDA);
      console.log(`💰 New balance: ${formatTokenAmount(Number(newBalance.amount))} USDC`);
      
    } catch (error) {
      console.error(`❌ Withdrawal failed for risk level ${riskLevel}:`, error);
    }
  }
  
  // Update SOL balance
  const finalSolBalance = await connection.getBalance(depositor.publicKey);
  balances[depositor.publicKey.toBase58()].sol = finalSolBalance / 1e9;
  
  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Withdrawal simulation complete!");
  console.log("📊 Final balances:");
  console.log("- SOL:", formatTokenAmount(balances[depositor.publicKey.toBase58()].sol, 9));
  console.log("- USDC:", formatTokenAmount(balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] || 0));
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
}

main().catch(console.error); 