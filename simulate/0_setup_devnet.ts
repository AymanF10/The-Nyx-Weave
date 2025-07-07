import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import * as spl from "@solana/spl-token";
import { NyxClient } from "../sdk/nyx-weave-client";
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
  users: { [key: string]: UserInfo }; // user name -> info
  lastUpdate: number;
}

interface UserInfo {
  pubkey: string;
  usdcTokenAccount: string;
  usdcBalance: number;
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
  console.log("⚠️ Note: Airdrops are disabled to avoid rate limiting (429 errors)");
  console.log("   Please ensure accounts have sufficient SOL before running this script");
  console.log("   Manual funding: solana airdrop 2 <PUBKEY> --url devnet");
  console.log("");
  
  // Initialize connection to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Define paths for state files
  const statePath = path.join(__dirname, 'nyx_state.json');
  const balancesPath = path.join(__dirname, 'balances.json');
  
  // Load or create keypairs
  let admin: Keypair;
  let deployer: Keypair;
  let ammWallet: Keypair;
  
  // Test user keypairs for various test scenarios
  let testUser1: Keypair;
  let testUser2: Keypair;
  let testUser3: Keypair;
  let testUser4: Keypair;
  let testUser5: Keypair;
  let unauthorizedUser: Keypair;
  
  try {
    // Try to load existing keypairs
    admin = loadKeypair("./simulate/admin-keypair.json");
    deployer = loadKeypair("./simulate/deployer-keypair.json");
    ammWallet = loadKeypair("./simulate/amm-wallet.json");
    testUser1 = loadKeypair("./simulate/test-user-1.json");
    testUser2 = loadKeypair("./simulate/test-user-2.json");
    testUser3 = loadKeypair("./simulate/test-user-3.json");
    testUser4 = loadKeypair("./simulate/test-user-4.json");
    testUser5 = loadKeypair("./simulate/test-user-5.json");
    unauthorizedUser = loadKeypair("./simulate/unauthorized-user.json");
    console.log("✅ Loaded existing keypairs");
  } catch (error) {
    console.log("📝 Creating new keypairs...");
    admin = Keypair.generate();
    deployer = Keypair.generate();
    ammWallet = Keypair.generate();
    testUser1 = Keypair.generate();
    testUser2 = Keypair.generate();
    testUser3 = Keypair.generate();
    testUser4 = Keypair.generate();
    testUser5 = Keypair.generate();
    unauthorizedUser = Keypair.generate();
    
    saveKeypair(admin, "./simulate/admin-keypair.json");
    saveKeypair(deployer, "./simulate/deployer-keypair.json");
    saveKeypair(ammWallet, "./simulate/amm-wallet.json");
    saveKeypair(testUser1, "./simulate/test-user-1.json");
    saveKeypair(testUser2, "./simulate/test-user-2.json");
    saveKeypair(testUser3, "./simulate/test-user-3.json");
    saveKeypair(testUser4, "./simulate/test-user-4.json");
    saveKeypair(testUser5, "./simulate/test-user-5.json");
    saveKeypair(unauthorizedUser, "./simulate/unauthorized-user.json");
    console.log("✅ Created and saved new keypairs");
  }

  console.log("\n📋 Keypair Information:");
  console.log("Admin:", admin.publicKey.toBase58());
  console.log("Deployer:", deployer.publicKey.toBase58());
  console.log("AMM Wallet:", ammWallet.publicKey.toBase58());
  console.log("Test User 1:", testUser1.publicKey.toBase58());
  console.log("Test User 2:", testUser2.publicKey.toBase58());
  console.log("Test User 3:", testUser3.publicKey.toBase58());
  console.log("Test User 4:", testUser4.publicKey.toBase58());
  console.log("Test User 5:", testUser5.publicKey.toBase58());
  console.log("Unauthorized User:", unauthorizedUser.publicKey.toBase58());

  // Create provider and client
  const wallet = new anchor.Wallet(deployer);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  console.log("\n🔧 Initializing Nyx-Weave client...");
  const client = new NyxClient(provider);

  // Check and fund balances
  console.log("\n💰 Checking Account Balances...");
  const balances: { [key: string]: BalanceInfo } = {};
  
  const accounts = [
    { name: "deployer", keypair: deployer },
    { name: "admin", keypair: admin },
    { name: "ammWallet", keypair: ammWallet },
    { name: "testUser1", keypair: testUser1 },
    { name: "testUser2", keypair: testUser2 },
    { name: "testUser3", keypair: testUser3 },
    { name: "testUser4", keypair: testUser4 },
    { name: "testUser5", keypair: testUser5 },
    { name: "unauthorizedUser", keypair: unauthorizedUser }
  ];

  for (const account of accounts) {
    const solBalance = await connection.getBalance(account.keypair.publicKey);
    balances[account.name] = { sol: solBalance / 1e9, tokens: {} };
    console.log(`${account.name}: ${formatTokenAmount(solBalance / 1e9, 9)} SOL`);
    
    if (solBalance < 0.1 * 1e9) {
      console.log(`⚠️ ${account.name} has insufficient SOL (${formatTokenAmount(solBalance / 1e9, 9)} SOL)`);
      console.log(`   Please fund manually: solana airdrop 2 ${account.keypair.publicKey.toBase58()} --url devnet`);
    }
  }
  
  // Fund users with SOL from admin wallet if admin has sufficient balance
  console.log("\n💰 Funding users with SOL from admin wallet...");
  const adminSolBalance = await connection.getBalance(admin.publicKey);
  const adminSolAmount = adminSolBalance / 1e9;
  
  if (adminSolAmount > 0.1) {
    console.log(`Admin has ${formatTokenAmount(adminSolAmount, 9)} SOL available for funding`);
    
    const usersToFund = [
      { name: "deployer", keypair: deployer },
      { name: "ammWallet", keypair: ammWallet },
      { name: "testUser1", keypair: testUser1 },
      { name: "testUser2", keypair: testUser2 },
      { name: "testUser3", keypair: testUser3 },
      { name: "testUser4", keypair: testUser4 },
      { name: "testUser5", keypair: testUser5 },
      { name: "unauthorizedUser", keypair: unauthorizedUser }
    ];
    
    for (const user of usersToFund) {
      const userSolBalance = await connection.getBalance(user.keypair.publicKey);
      const userSolAmount = userSolBalance / 1e9;
      
      if (userSolAmount < 0.1) {
        const amountToTransfer = 0.2 - userSolAmount; // Give them 0.2 SOL total
        const transferAmount = Math.min(amountToTransfer, 0.2) * 1e9; // Convert to lamports
        
        if (adminSolAmount >= amountToTransfer) {
          try {
            const transaction = new anchor.web3.Transaction().add(
              SystemProgram.transfer({
                fromPubkey: admin.publicKey,
                toPubkey: user.keypair.publicKey,
                lamports: transferAmount,
              })
            );
            
            const signature = await sendAndConfirmTransaction(
              connection,
              transaction,
              [admin],
              { commitment: "confirmed" }
            );
            
            console.log(`✅ Funded ${user.name} with ${formatTokenAmount(amountToTransfer, 9)} SOL (tx: ${signature})`);
            
            // Update balances
            balances[user.name].sol = 0.2;
            balances.admin.sol = adminSolAmount - amountToTransfer;
          } catch (error) {
            console.log(`⚠️ Failed to fund ${user.name} with SOL:`, error);
          }
        } else {
          console.log(`⚠️ Admin has insufficient SOL to fund ${user.name} (needs ${formatTokenAmount(amountToTransfer, 9)} SOL)`);
        }
      } else {
        console.log(`ℹ️ ${user.name} already has sufficient SOL (${formatTokenAmount(userSolAmount, 9)} SOL)`);
      }
    }
  } else {
    console.log(`⚠️ Admin has insufficient SOL (${formatTokenAmount(adminSolAmount, 9)} SOL) to fund other users`);
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
    users: {},
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
        const initAdminTx = await client.initAdmins(admin.publicKey);
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
        const initConfigTx = await client.initGlobalConfig({          
          admin,
          feeBps: 1000, // feeBps: 10%
          minProfitThreshold: 1000, // minProfitThreshold: 0.001 tokens
          maxRetries: 2     // maxRetries
          }
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
  console.log("\n🪙 Step 3: Setting up Test USDC Mint...");
  
  let usdcMint: PublicKey;
  
  if (!state.usdcMint) {
    console.log("Creating new USDC mint...");
    try {
      usdcMint = await client.createMint({ authority: admin });
      state.usdcMint = usdcMint.toBase58();
      console.log("✅ USDC mint created:", usdcMint.toBase58());
    } catch (error) {
      console.log("❌ Failed to create USDC mint:", error);
      throw error;
    }
  } else {
    console.log("Using existing USDC mint:", state.usdcMint);
    usdcMint = new PublicKey(state.usdcMint);
  }
  
  // If we have existing users in state, use them instead of recreating
  if (Object.keys(state.users).length > 0) {
    console.log("📂 Found existing user state, using existing users...");
    console.log("Existing users:", Object.keys(state.users).join(", "));
  }
  
  // Always ensure USDC funding is set up
  console.log("Setting up USDC funding...");
  
  // Fund AMM wallet with USDC
  if (!state.users.ammWallet) {
    console.log("Setting up AMM wallet USDC account...");
    try {
      const ammWalletATA = await spl.getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        usdcMint,
        ammWallet.publicKey
      );
      
      // Check current balance
      const currentBalance = await spl.getAccount(connection, ammWalletATA.address);
      const currentAmount = Number(currentBalance.amount) / 10 ** 6;
      
      if (currentAmount < 1000000) {
        const amountToMint = (1000000 - currentAmount) * 10 ** 6;
        await spl.mintTo(
          connection,
          admin,
          usdcMint,
          ammWalletATA.address,
          admin,
          amountToMint
        );
        console.log(`✅ Funded AMM wallet with ${amountToMint / 10 ** 6} USDC (total: 1M USDC)`);
      } else {
        console.log(`ℹ️ AMM wallet already has ${currentAmount} USDC`);
      }
      
      balances.ammWallet.tokens[usdcMint.toBase58()] = 1000000;
      
      // Store AMM wallet info in state
      state.users.ammWallet = {
        pubkey: ammWallet.publicKey.toBase58(),
        usdcTokenAccount: ammWalletATA.address.toBase58(),
        usdcBalance: 1000000
      };
    } catch (error) {
      console.log("⚠️ Failed to fund AMM wallet with USDC:", error);
    }
  } else {
    console.log("ℹ️ AMM wallet already exists in state, skipping setup");
    balances.ammWallet.tokens[usdcMint.toBase58()] = state.users.ammWallet.usdcBalance;
  }
  
    // Fund test users with USDC
  console.log("Funding test users with USDC...");
  const testUsers = [
    { name: "testUser1", keypair: testUser1, amount: 10000 },
    { name: "testUser2", keypair: testUser2, amount: 15000 },
    { name: "testUser3", keypair: testUser3, amount: 20000 },
    { name: "testUser4", keypair: testUser4, amount: 25000 },
    { name: "testUser5", keypair: testUser5, amount: 30000 }
  ];
  
  for (const user of testUsers) {
    if (!state.users[user.name]) {
      console.log(`Setting up ${user.name} USDC account...`);
      try {
        const userATA = await spl.getOrCreateAssociatedTokenAccount(
          connection,
          admin,
          usdcMint,
          user.keypair.publicKey
        );
        
        // Check current balance
        const currentBalance = await spl.getAccount(connection, userATA.address);
        const currentAmount = Number(currentBalance.amount) / 10 ** 6;
        
        if (currentAmount < user.amount) {
          const amountToMint = (user.amount - currentAmount) * 10 ** 6;
          await spl.mintTo(
            connection,
            admin,
            usdcMint,
            userATA.address,
            admin,
            amountToMint
          );
          console.log(`✅ Funded ${user.name} with ${amountToMint / 10 ** 6} USDC (total: ${user.amount} USDC)`);
        } else {
          console.log(`ℹ️ ${user.name} already has ${currentAmount} USDC`);
        }
        
        balances[user.name] = balances[user.name] || { sol: 0, tokens: {} };
        balances[user.name].tokens[usdcMint.toBase58()] = user.amount;
        
        // Store user info in state
        state.users[user.name] = {
          pubkey: user.keypair.publicKey.toBase58(),
          usdcTokenAccount: userATA.address.toBase58(),
          usdcBalance: user.amount
        };
      } catch (error) {
        console.log(`⚠️ Failed to fund ${user.name} with USDC:`, error);
      }
    } else {
      console.log(`ℹ️ ${user.name} already exists in state, skipping setup`);
      balances[user.name] = balances[user.name] || { sol: 0, tokens: {} };
      balances[user.name].tokens[usdcMint.toBase58()] = state.users[user.name].usdcBalance;
    }
  }
  
  // Verify USDC mint setup
  console.log("\n🔍 Verifying USDC mint setup...");
  try {
    const mintInfo = await spl.getMint(connection, usdcMint);
    console.log(`✅ USDC mint verified: ${usdcMint.toBase58()}`);
    console.log(`   Decimals: ${mintInfo.decimals}`);
    console.log(`   Supply: ${formatTokenAmount(Number(mintInfo.supply), 6)} USDC`);
    console.log(`   Mint Authority: ${mintInfo.mintAuthority?.toBase58() || 'None'}`);
  } catch (error) {
    console.log("❌ Failed to verify USDC mint:", error);
  }
  
  // Setup admin and deployer USDC accounts
  console.log("\n👤 Setting up admin and deployer USDC accounts...");
  
  if (!state.users.admin) {
    console.log("Setting up admin USDC account...");
    try {
      const adminATA = await spl.getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        usdcMint,
        admin.publicKey
      );
      
      state.users.admin = {
        pubkey: admin.publicKey.toBase58(),
        usdcTokenAccount: adminATA.address.toBase58(),
        usdcBalance: 0 // Admin doesn't need USDC for testing
      };
      console.log("✅ Admin USDC account created");
    } catch (error) {
      console.log("⚠️ Failed to setup admin USDC account:", error);
    }
  } else {
    console.log("ℹ️ Admin already exists in state, skipping setup");
  }
  
  if (!state.users.deployer) {
    console.log("Setting up deployer USDC account...");
    try {
      const deployerATA = await spl.getOrCreateAssociatedTokenAccount(
        connection,
        admin,
        usdcMint,
        deployer.publicKey
      );
      
      state.users.deployer = {
        pubkey: deployer.publicKey.toBase58(),
        usdcTokenAccount: deployerATA.address.toBase58(),
        usdcBalance: 0 // Deployer doesn't need USDC for testing
      };
      console.log("✅ Deployer USDC account created");
    } catch (error) {
      console.log("⚠️ Failed to setup deployer USDC account:", error);
    }
  } else {
    console.log("ℹ️ Deployer already exists in state, skipping setup");
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
          const createStrategyTx = await client.createStrategyVault({
            admin,
            mint: new PublicKey(state.usdcMint || "Fhbg8rGkU2EqKbDcEemescDcpQCZerNhmCK2QgcEFeGx"),
            riskLevel
          }
          );
          console.log(`✅ Strategy vault created for risk level ${riskLevel}:`, createStrategyTx);
        } else {
          console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists, adding pda ${strategyVaultPda.toBase58()}`);
        }
        
        state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
      } catch (error) {
        console.log(`ℹ️ Error creating strategy vault for risk level ${riskLevel}:`, error);
        // const [strategyVaultPda] = await client.getStrategyVaultAddress(new PublicKey(state.usdcMint), riskLevel);
        // console.log(`ℹ️ Strategy vault for risk level ${riskLevel} already exists, adding pda ${strategyVaultPda.toBase58()}`);
        // state.strategyVaults[vaultKey] = strategyVaultPda.toBase58();
      }
    }
  }

  state.treasuryVault = (await client.getTreasuryVaultAddress())[0].toBase58();
  const adminInGlobalConfig = (await client.getGlobalConfig()).admin.toBase58();
  state.admin = adminInGlobalConfig;

  // Save state
  state.lastUpdate = Date.now();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  fs.writeFileSync(balancesPath, JSON.stringify(balances, null, 2));
  
  console.log("\n🎉 Setup Complete!");
  console.log("📁 State saved to:", statePath);
  console.log("💰 Balances saved to:", balancesPath);
  
  // Check if any accounts need funding
  const accountsNeedingFunding = Object.entries(balances).filter(([name, balance]) => balance.sol < 0.1);
  if (accountsNeedingFunding.length > 0) {
    console.log("\n⚠️ Accounts needing SOL funding:");
    for (const [name, balance] of accountsNeedingFunding) {
      const keypair = accounts.find(acc => acc.name === name)?.keypair;
      if (keypair) {
        console.log(`   ${name}: solana airdrop 2 ${keypair.publicKey.toBase58()} --url devnet`);
      }
    }
    console.log("   Note: Run airdrops one at a time to avoid rate limits");
  }
  console.log("\n📊 Current State:");
  console.log("- Administrators:", state.administrators);
  console.log("- Global Config:", state.globalConfig);
  console.log("- USDC Mint:", state.usdcMint);
  console.log("- Strategy Vaults:", Object.keys(state.strategyVaults).length);
  console.log("- AMM Wallets:", Object.keys(state.ammWallets).length);
  console.log("- Test Users:", Object.keys(state.users).length);
  
  console.log("\n👥 User Information:");
  for (const [userName, userInfo] of Object.entries(state.users)) {
    console.log(`\n${userName}:`);
    console.log(`  Public Key: ${userInfo.pubkey}`);
    console.log(`  USDC Token Account: ${userInfo.usdcTokenAccount}`);
    console.log(`  USDC Balance: ${formatTokenAmount(userInfo.usdcBalance, 6)} USDC`);
  }
  
  console.log("\n💰 Account Balances:");
  for (const [accountName, balance] of Object.entries(balances)) {
    console.log(`  ${accountName}: ${formatTokenAmount(balance.sol, 9)} SOL`);
    for (const [mint, amount] of Object.entries(balance.tokens)) {
      console.log(`    ${mint}: ${formatTokenAmount(amount, 6)} USDC`);
    }
  }
}

main().catch(console.error); 