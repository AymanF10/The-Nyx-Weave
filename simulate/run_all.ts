#!/usr/bin/env ts-node

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const scripts = [
  '0_setup_devnet.ts',
  '1_create_strategy.ts', 
  '2_deposit.ts',
  '4_execute_arbitrage.ts',
  '5_claim_profits.ts',
  '6_check_balances.ts'
];

async function runScript(scriptName: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running ${scriptName}...`);
    console.log('='.repeat(50));
    
    const child = spawn('npx', ['ts-node', path.join(__dirname, scriptName)], {
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed successfully`);
        resolve(true);
      } else {
        console.error(`❌ ${scriptName} failed with code ${code}`);
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error running ${scriptName}:`, error);
      resolve(false);
    });
  });
}

async function main() {
  console.log('🎯 Nyx Weave Complete Simulation Suite');
  console.log('='.repeat(60));
  console.log('This will run all simulation scripts in sequence.');
  console.log('Make sure you have:');
  console.log('- Node.js and npm installed');
  console.log('- Solana CLI configured for devnet');
  console.log('- Anchor framework installed');
  console.log('- Program deployed to devnet');
  console.log('');
  
  // Check if state already exists
  const statePath = path.join(__dirname, 'nyx_state.json');
  if (fs.existsSync(statePath)) {
    console.log('⚠️  State file already exists. This will overwrite existing state.');
    console.log('Press Ctrl+C to cancel or any key to continue...');
    
    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      startSimulation();
    });
  } else {
    startSimulation();
  }
}

async function startSimulation() {
  console.log('\n🎬 Starting simulation...\n');
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const script of scripts) {
    const success = await runScript(script);
    if (success) {
      successCount++;
    } else {
      failureCount++;
      console.log(`\n⚠️  Script ${script} failed. You can:`);
      console.log(`   1. Fix the issue and run: npx ts-node simulate/${script}`);
      console.log(`   2. Continue with remaining scripts`);
      console.log(`   3. Restart from the beginning`);
      
      const shouldContinue = await askContinue();
      if (!shouldContinue) {
        console.log('\n🛑 Simulation stopped by user');
        process.exit(1);
      }
    }
  }
  
  console.log('\n🎉 Simulation Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Successful scripts: ${successCount}`);
  console.log(`❌ Failed scripts: ${failureCount}`);
  
  if (failureCount === 0) {
    console.log('\n🎊 All scripts completed successfully!');
    console.log('📊 Check the following files for results:');
    console.log('   - simulate/nyx_state.json (program state)');
    console.log('   - simulate/balances.json (account balances)');
    console.log('   - simulate/balance_report.json (detailed report)');
  } else {
    console.log('\n⚠️  Some scripts failed. Check the output above for details.');
  }
}

function askContinue(): Promise<boolean> {
  return new Promise((resolve) => {
    console.log('\nContinue with remaining scripts? (y/n): ');
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase();
      resolve(input === 'y' || input === 'yes');
    });
  });
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n🛑 Simulation interrupted by user');
  process.exit(0);
});

main().catch(console.error); 