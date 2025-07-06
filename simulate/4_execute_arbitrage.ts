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
  console.log("🔄 Arbitrage Execution Simulation...");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load keypairs
  const deployer = loadKeypair("./simulate/deployer-keypair.json");
  const ammWallet = loadKeypair("./simulate/amm-wallet.json");
  
  console.log("AMM Wallet:", ammWallet.publicKey.toBase58());
  
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
  
  // Check AMM wallet balance
  const ammWalletATA = spl.getAssociatedTokenAddressSync(usdcMint, ammWallet.publicKey);
  const ammBalance = await spl.getAccount(connection, ammWalletATA);
  console.log("💰 AMM Wallet USDC balance:", formatTokenAmount(Number(ammBalance.amount)));
  
  // Execute arbitrage for different risk levels
  const arbitrageAmounts = {
    1: 100 * 10 ** 6,  // 100 USDC profit
    2: 200 * 10 ** 6,  // 200 USDC profit
    3: 150 * 10 ** 6   // 150 USDC profit
  };
  
  for (const [riskLevel, amount] of Object.entries(arbitrageAmounts)) {
    const vaultKey = `risk_${riskLevel}`;
    const strategyVaultPDA = state.strategyVaults[vaultKey];
    
    if (!strategyVaultPDA) {
      console.log(`❌ Strategy vault for risk level ${riskLevel} not found`);
      continue;
    }
    
    console.log(`\n🔄 Executing arbitrage for risk level ${riskLevel} with ${formatTokenAmount(amount)} USDC profit...`);
    
    try {
      await client.executeArbitrageMock(
        ammWallet,
        usdcMint,
        parseInt(riskLevel),
        amount
      );
      
      console.log(`✅ Arbitrage executed successfully for vault:`, strategyVaultPDA);
      
      // Get updated vault data
      const vaultData = await client.getStrategyVault(usdcMint, parseInt(riskLevel));
      console.log(`📊 Updated vault data:`, {
        address: vaultData.address,
        exists: vaultData.exists
      });
      
      // Get updated AMM wallet balance
      const newAmmBalance = await spl.getAccount(connection, ammWalletATA);
      balances.ammWallet.tokens[usdcMint.toBase58()] = Number(newAmmBalance.amount) / 10 ** 6;
      console.log(`💰 New AMM wallet balance:`, formatTokenAmount(Number(newAmmBalance.amount)));
      
    } catch (error) {
      console.error(`❌ Arbitrage execution failed for risk level ${riskLevel}:`, error);
    }
  }
  
  // Update AMM wallet SOL balance
  const ammSolBalance = await connection.getBalance(ammWallet.publicKey);
  balances.ammWallet.sol = ammSolBalance / 1e9;
  
  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Arbitrage execution complete!");
  console.log("📊 Final AMM wallet balances:");
  console.log("- SOL:", formatTokenAmount(balances.ammWallet.sol, 9));
  console.log("- USDC:", formatTokenAmount(balances.ammWallet.tokens[usdcMint.toBase58()] || 0));
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
}

main().catch(console.error); 