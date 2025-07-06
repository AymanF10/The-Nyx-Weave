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
  strategyVaults: { [key: string]: string }; // riskLevel -> PDA
  depositors: { [key: string]: DepositorInfo }; // userPubkey -> info
  ammWallets: { [key: string]: string }; // name -> pubkey
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
  console.log("🚀 Setting up Nyx Weave on Devnet...");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Define paths for state files
  const statePath = path.join(__dirname, 'nyx_state.json');
  const balancesPath = path.join(__dirname, 'balances.json');
  
  // Load or create keypairs
  let admin: Keypair;
  let deployer: Keypair;
  let ammWallet: Keypair;
  
  try {
    // Try to load existing keypairs
    admin = loadKeypair("./simulate/admin-keypair.json");
    deployer = loadKeypair("./simulate/deployer-keypair.json");
    ammWallet = loadKeypair("./simulate/amm-wallet.json");
    console.log("✅ Loaded existing keypairs");
  } catch (error) {
    console.log("📝 Creating new keypairs...");
    admin = Keypair.generate();
    deployer = Keypair.generate();
    ammWallet = Keypair.generate();
    
    saveKeypair(admin, "./simulate/admin-keypair.json");
    saveKeypair(deployer, "./simulate/deployer-keypair.json");
    saveKeypair(ammWallet, "./simulate/amm-wallet.json");
    console.log("✅ Created and saved new keypairs");
  }

  console.log("\n📋 Keypair Information:");
  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Deployer:", deployer.publicKey.toBase58());
  console.log("AMM Wallet:", ammWallet.publicKey.toBase58());

  // Create provider and client
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("\n🔧 Initializing Nyx-Weave client...");
  const client = new NyxWeaveClient(provider);

  // Check and fund balances
  console.log("\n💰 Checking Account Balances...");
  const balances: { [key: string]: BalanceInfo } = {};
  
  const accounts = [
    { name: "deployer", keypair: deployer },
    { name: "admin", keypair: admin },
    { name: "ammWallet", keypair: ammWallet }
  ];

  for (const account of accounts) {
    const solBalance = await connection.getBalance(account.keypair.publicKey);
    balances[account.name] = { sol: solBalance / 1e9, tokens: {} };
    console.log(`${account.name}: ${formatTokenAmount(solBalance / 1e9, 9)} SOL`);
    
    if (solBalance < 0.1 * 1e9) {
      console.log(`Requesting airdrop for ${account.name}...`);
      try {
        const airdropSig = await connection.requestAirdrop(account.keypair.publicKey, 2 * 1e9);
        await connection.confirmTransaction(airdropSig, "confirmed");
        console.log(`✅ Airdrop successful for ${account.name}`);
      } catch (error) {
        console.log(`❌ Airdrop failed for ${account.name}. Please fund manually.`);
      }
    }
  }

  // Load or create program state
  let state: ProgramState = {
    admin: admin.publicKey.toBase58(),
    administrators: "",
    globalConfig: "",
    treasuryVault: "",
    usdcMint: "",
    strategyVaults: {},
    depositors: {},
    ammWallets: {
      "main": ammWallet.publicKey.toBase58()
    },
    lastUpdate: Date.now()
  };

  if (fs.existsSync(statePath)) {
    const existingState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    state = { ...state, ...existingState };
    console.log("📂 Loaded existing program state");
  }

  // Step 1: Initialize Administrators
  if (!state.administrators) {
    console.log("\n👥 Step 1: Initializing Administrators...");
    try {
      const [administratorsPda] = await client.getAdministratorsAddress();
      const administratorsExists = await client.accountExists(administratorsPda);
      
      if (!administratorsExists) {
        const initAdminTx = await client.initializeAdministrators(admin.publicKey);
        console.log("✅ Administrators initialized:", initAdminTx);
      } else {
        console.log("ℹ️ Administrators already initialized");
      }
      
      state.administrators = administratorsPda.toBase58();
    } catch (error) {
      console.log("ℹ️ Administrators already initialized");
    }
  }

  // Step 2: Initialize Global Config
  if (!state.globalConfig) {
    console.log("\n⚙️ Step 2: Initializing Global Config...");
    try {
      const [globalConfigPda] = await client.getGlobalConfigAddress();
      const globalConfigExists = await client.accountExists(globalConfigPda);
      
      if (!globalConfigExists) {
        const initConfigTx = await client.initializeConfigTreasury(
          admin,
          1000, // feeBps: 10%
          1000, // minProfitThreshold: 0.001 tokens
          2     // maxRetries
        );
        console.log("✅ Global config initialized:", initConfigTx);
      } else {
        console.log("ℹ️ Global config already initialized");
      }
      
      state.globalConfig = globalConfigPda.toBase58();
    } catch (error) {
      console.log("ℹ️ Global config already initialized");
    }
  }

  // Step 3: Create USDC mint for testing
  if (!state.usdcMint) {
    console.log("\n🪙 Step 3: Creating Test USDC Mint...");
    try {
      const usdcMint = await spl.createMint(
        connection,
        admin,
        admin.publicKey,
        null,
        6 // decimals
      );
      state.usdcMint = usdcMint.toBase58();
      console.log("✅ USDC mint created:", usdcMint.toBase58());
      
      // Fund AMM wallet with USDC
      const ammWalletATA = await spl.getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        usdcMint,
        ammWallet.publicKey
      );
      
      await spl.mintTo(
        connection,
        admin,
        usdcMint,
        ammWalletATA.address,
        admin,
        1000000 * 10 ** 6 // 1M USDC
      );
      
      balances.ammWallet.tokens[usdcMint.toBase58()] = 1000000;
      console.log("✅ Funded AMM wallet with 1M USDC");
    } catch (error) {
      console.log("ℹ️ USDC mint already exists");
    }
  }

  // Step 4: Create strategy vaults
  console.log("\n🏦 Step 4: Creating Strategy Vaults...");
  const riskLevels = [1, 2, 3];
  
  for (const riskLevel of riskLevels) {
    const vaultKey = `risk_${riskLevel}`;
    if (!state.strategyVaults[vaultKey]) {
      try {
        const [strategyVaultPda] = await client.getStrategyVaultAddress(new PublicKey(state.usdcMint), riskLevel);
        const strategyVaultExists = await client.accountExists(strategyVaultPda);
        
        if (!strategyVaultExists) {
          const createStrategyTx = await client.createStrategy(
            admin,
            new PublicKey(state.usdcMint),
            riskLevel
          );
          console.log(`✅ Strategy vault created for risk level ${riskLevel}:`, createStrategyTx);
        } else {
          console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists`);
        }
        
        state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
      } catch (error) {
        console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists`);
      }
    }
  }

  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Setup Complete!");
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
  console.log("\n📊 Current State:");
  console.log("- Administrators:", state.administrators);
  console.log("- Global Config:", state.globalConfig);
  console.log("- USDC Mint:", state.usdcMint);
  console.log("- Strategy Vaults:", Object.keys(state.strategyVaults).length);
  console.log("- AMM Wallets:", Object.keys(state.ammWallets).length);
}

main().catch(console.error); 