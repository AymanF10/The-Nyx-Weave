import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { NyxWeaveClient } from "../sdk/nyx-weave-client";
import { loadKeypair, saveKeypair, formatTokenAmount, toRawAmount } from "./util";
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
  deposits: { [key: string]: number }; // strategyVaultPDA -> amount
  lastDeposit: number;
}

interface BalanceInfo {
  sol: number;
  tokens: { [mint: string]: number };
}

async function main() {
  console.log("💰 User Deposit Simulation...");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load keypairs
  const admin = loadKeypair("./simulate/admin-keypair.json");
  const deployer = loadKeypair("./simulate/deployer-keypair.json");
  
  // Create or load depositor
  let depositor: Keypair;
  try {
    depositor = loadKeypair("./simulate/depositor-keypair.json");
    console.log("📂 Loaded existing depositor");
  } catch (error) {
    depositor = Keypair.generate();
    saveKeypair(depositor, "./simulate/depositor-keypair.json");
    console.log("📝 Created new depositor");
  }
  
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
  
  // Check depositor balance and fund if needed
  const depositorSolBalance = await connection.getBalance(depositor.publicKey);
  if (depositorSolBalance < 0.1 * 1e9) {
    console.log("Requesting airdrop for depositor...");
    try {
      const airdropSig = await connection.requestAirdrop(depositor.publicKey, 2 * 1e9);
      await connection.confirmTransaction(airdropSig, "confirmed");
      console.log("✅ Airdrop successful");
    } catch (error) {
      console.log("❌ Airdrop failed. Please fund manually.");
    }
  }
  
  // Fund depositor with USDC
  const depositorATA = spl.getAssociatedTokenAddressSync(usdcMint, depositor.publicKey);
  try {
    const ataAccount = await spl.getAccount(connection, depositorATA);
    console.log("✅ Depositor ATA exists");
  } catch (error) {
    console.log("Creating depositor ATA...");
    await spl.getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      usdcMint,
      depositor.publicKey
    );
    console.log("✅ Depositor ATA created");
  }
  
  // Mint USDC to depositor
  const currentBalance = await spl.getAccount(connection, depositorATA);
  if (Number(currentBalance.amount) < 1000 * 10 ** 6) {
    console.log("Minting USDC to depositor...");
    await spl.mintTo(
      connection,
      admin,
      usdcMint,
      depositorATA,
      admin,
      10000 * 10 ** 6 // 10k USDC
    );
    console.log("✅ Funded depositor with 10k USDC");
  }
  
  // Initialize depositor in state if not exists
  if (!state.depositors[depositor.publicKey.toBase58()]) {
    state.depositors[depositor.publicKey.toBase58()] = {
      pubkey: depositor.publicKey.toBase58(),
      ata: depositorATA.toBase58(),
      deposits: {},
      lastDeposit: Date.now()
    };
  }
  
  // Initialize balances for depositor
  if (!balances[depositor.publicKey.toBase58()]) {
    balances[depositor.publicKey.toBase58()] = {
      sol: depositorSolBalance / 1e9,
      tokens: {}
    };
  }
  
  // Make deposits to different risk levels
  const depositAmounts = {
    1: 1000 * 10 ** 6, // 1k USDC
    2: 2000 * 10 ** 6, // 2k USDC
    3: 1500 * 10 ** 6  // 1.5k USDC
  };
  
  for (const [riskLevel, amount] of Object.entries(depositAmounts)) {
    const vaultKey = `risk_${riskLevel}`;
    const strategyVaultPDA = state.strategyVaults[vaultKey];
    
    if (!strategyVaultPDA) {
      console.log(`❌ Strategy vault for risk level ${riskLevel} not found`);
      continue;
    }
    
    console.log(`\n💰 Depositing ${formatTokenAmount(amount)} USDC to risk level ${riskLevel}...`);
    
    try {
      await client.userDeposit(
        depositor,
        usdcMint,
        parseInt(riskLevel),
        amount
      );
      
      // Update state
      state.depositors[depositor.publicKey.toBase58()].deposits[strategyVaultPDA] = 
        (state.depositors[depositor.publicKey.toBase58()].deposits[strategyVaultPDA] || 0) + amount;
      state.depositors[depositor.publicKey.toBase58()].lastDeposit = Date.now();
      
      console.log(`✅ Deposit successful to vault:`, strategyVaultPDA);
      
      // Get updated balances
      const newBalance = await spl.getAccount(connection, depositorATA);
      balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] = Number(newBalance.amount) / 10 ** 6;
      
      console.log(`✅ Deposit successful to vault:`, strategyVaultPDA);
      console.log(`💰 New balance: ${formatTokenAmount(Number(newBalance.amount))} USDC`);
      
    } catch (error) {
      console.error(`❌ Deposit failed for risk level ${riskLevel}:`, error);
    }
  }
  
  // Update SOL balance
  const finalSolBalance = await connection.getBalance(depositor.publicKey);
  balances[depositor.publicKey.toBase58()].sol = finalSolBalance / 1e9;
  
  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Deposit simulation complete!");
  console.log("📊 Final balances:");
  console.log("- SOL:", formatTokenAmount(balances[depositor.publicKey.toBase58()].sol, 9));
  console.log("- USDC:", formatTokenAmount(balances[depositor.publicKey.toBase58()].tokens[usdcMint.toBase58()] || 0));
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
}

main().catch(console.error);