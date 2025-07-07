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

interface VaultBalance {
  strategyVault: string;
  riskLevel: number;
  totalDeposits: string;
  totalProfit: string;
  isActive: boolean;
  isDelegated: boolean;
  vaultTokenBalance: string;
}

interface UserBalance {
  pubkey: string;
  sol: string;
  tokens: { [mint: string]: string };
  deposits: { [vault: string]: string };
  lastDeposit: string;
}

async function main() {
  console.log("📊 Nyx Weave Balance Checker");
  console.log("=".repeat(50));
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load keypairs
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
  const balancesPath = path.join(__dirname, 'balances.json');
  
  if (!fs.existsSync(statePath)) {
    console.error("❌ No state file found. Run 0_setup_devnet.ts first.");
    process.exit(1);
  }
  
  const state: ProgramState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const balances: { [key: string]: BalanceInfo } = fs.existsSync(balancesPath) 
    ? JSON.parse(fs.readFileSync(balancesPath, 'utf8'))
    : {};

  const usdcMint = new PublicKey(state.usdcMint);
  
  console.log("\n🏛️ Program State:");
  console.log("- Admin:", state.admin);
  console.log("- Administrators PDA:", state.administrators);
  console.log("- Global Config PDA:", state.globalConfig);
  console.log("- USDC Mint:", state.usdcMint);
  console.log("- Last Update:", new Date(state.lastUpdate).toISOString());
  
  // Check strategy vaults
  console.log("\n🏦 Strategy Vaults:");
  const vaultBalances: VaultBalance[] = [];
  
  for (const [vaultKey, vaultPDA] of Object.entries(state.strategyVaults)) {
    const riskLevel = parseInt(vaultKey.split('_')[1]);
    
    try {
      const vaultData = await client.getStrategyVault(usdcMint, riskLevel);
      const vaultATA = spl.getAssociatedTokenAddressSync(usdcMint, new PublicKey(vaultPDA), true);
      const vaultTokenBalance = await spl.getAccount(connection, vaultATA);
      
      vaultBalances.push({
        strategyVault: vaultPDA,
        riskLevel,
        totalDeposits: "0", // Simplified for now
        totalProfit: "0", // Simplified for now
        isActive: true, // Simplified for now
        isDelegated: false, // Simplified for now
        vaultTokenBalance: formatTokenAmount(Number(vaultTokenBalance.amount))
      });
      
      console.log(`  Risk Level ${riskLevel}:`);
      console.log(`    PDA: ${vaultPDA}`);
      console.log(`    Vault Balance: ${formatTokenAmount(Number(vaultTokenBalance.amount))} USDC`);
      console.log(`    Address: ${vaultData.address}`);
      console.log(`    Exists: ${vaultData.exists}`);
      
    } catch (error) {
      console.log(`  Risk Level ${riskLevel}: Error fetching data - ${error}`);
    }
  }
  
  // Check treasury vault
  console.log("\n💰 Treasury Vault:");
  try {
    const [treasuryVaultPDA] = await client.getTreasuryVaultAddress();
    
    const treasuryATA = spl.getAssociatedTokenAddressSync(usdcMint, treasuryVaultPDA, true);
    const treasuryBalance = await spl.getAccount(connection, treasuryATA);
    
    console.log(`  PDA: ${treasuryVaultPDA.toBase58()}`);
    console.log(`  Balance: ${formatTokenAmount(Number(treasuryBalance.amount))} USDC`);
    
  } catch (error) {
    console.log(`  Error fetching treasury data: ${error}`);
  }
  
  // Check user balances
  console.log("\n👥 User Balances:");
  const userBalances: UserBalance[] = [];
  
  for (const [userPubkey, depositorInfo] of Object.entries(state.depositors)) {
    try {
      const userKeypair = new PublicKey(userPubkey);
      const solBalance = await connection.getBalance(userKeypair);
      const userATA = spl.getAssociatedTokenAddressSync(usdcMint, userKeypair);
      const tokenBalance = await spl.getAccount(connection, userATA);
      
      const userBalance: UserBalance = {
        pubkey: userPubkey,
        sol: formatTokenAmount(solBalance / 1e9, 9),
        tokens: {
          [usdcMint.toBase58()]: formatTokenAmount(Number(tokenBalance.amount))
        },
        deposits: {},
        lastDeposit: new Date(depositorInfo.lastDeposit).toISOString()
      };
      
      // Get deposit details for each vault
      for (const [vaultPDA, depositAmount] of Object.entries(depositorInfo.deposits)) {
        userBalance.deposits[vaultPDA] = formatTokenAmount(depositAmount);
      }
      
      userBalances.push(userBalance);
      
      console.log(`  User: ${userPubkey}`);
      console.log(`    SOL: ${formatTokenAmount(solBalance / 1e9, 9)}`);
      console.log(`    USDC: ${formatTokenAmount(Number(tokenBalance.amount))}`);
      console.log(`    Deposits: ${Object.keys(depositorInfo.deposits).length} vaults`);
      console.log(`    Last Deposit: ${new Date(depositorInfo.lastDeposit).toISOString()}`);
      
      // Show deposit details
      for (const [vaultPDA, depositAmount] of Object.entries(depositorInfo.deposits)) {
        const vaultKey = Object.keys(state.strategyVaults).find(key => state.strategyVaults[key] === vaultPDA);
        const riskLevel = vaultKey ? vaultKey.split('_')[1] : 'unknown';
        console.log(`      Risk Level ${riskLevel}: ${formatTokenAmount(depositAmount)} USDC`);
      }
      
    } catch (error) {
      console.log(`  User ${userPubkey}: Error fetching data - ${error}`);
    }
  }
  
  // Check AMM wallet balances
  console.log("\n🤖 AMM Wallet Balances:");
  for (const [ammName, ammPubkey] of Object.entries(state.ammWallets)) {
    try {
      const ammKeypair = new PublicKey(ammPubkey);
      const solBalance = await connection.getBalance(ammKeypair);
      const ammATA = spl.getAssociatedTokenAddressSync(usdcMint, ammKeypair);
      const tokenBalance = await spl.getAccount(connection, ammATA);
      
      console.log(`  ${ammName}:`);
      console.log(`    Address: ${ammPubkey}`);
      console.log(`    SOL: ${formatTokenAmount(solBalance / 1e9, 9)}`);
      console.log(`    USDC: ${formatTokenAmount(Number(tokenBalance.amount))}`);
      
    } catch (error) {
      console.log(`  ${ammName}: Error fetching data - ${error}`);
    }
  }
  
  // Save detailed balance report
  const reportPath = path.join(__dirname, 'balance_report.json');
  const report = {
    timestamp: new Date().toISOString(),
    programState: state,
    vaultBalances,
    userBalances,
    summary: {
      totalVaults: vaultBalances.length,
      totalUsers: userBalances.length,
      totalAmmWallets: Object.keys(state.ammWallets).length
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log("\n📊 Summary:");
  console.log(`- Total Strategy Vaults: ${vaultBalances.length}`);
  console.log(`- Total Users: ${userBalances.length}`);
  console.log(`- Total AMM Wallets: ${Object.keys(state.ammWallets).length}`);
  console.log(`- Report saved to: ${reportPath}`);
  
  console.log("\n🎉 Balance check complete!");
}

main().catch(console.error); 