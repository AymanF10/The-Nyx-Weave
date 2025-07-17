#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as path from 'path';

async function main() {
  console.log("🚀 Running Ephemeral Rollup Delegation Tests");
  console.log("=============================================");
  
  try {
    // Step 1: Run the setup script
    console.log("\n📋 Step 1: Setting up devnet environment...");
    execSync('yarn setup:devnet', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log("✅ Setup completed successfully");
    
    // Step 2: Run the ER delegation tests
    console.log("\n🧪 Step 2: Running ER delegation tests...");
    execSync('anchor test tests/er-delegation-commit.ts --skip-deploy', { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log("✅ Tests completed successfully");
    
  } catch (error) {
    console.error("❌ Error running tests:", error);
    process.exit(1);
  }
}

main().catch(console.error); 