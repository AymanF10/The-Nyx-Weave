# Ephemeral Rollup Delegation Tests

This directory contains tests for the Ephemeral Rollup (ER) delegation and commit functionality of the Nyx Weave platform.

## Test Files

- `er-delegation-commit.ts` - Main test suite for ER delegation and commit operations
- `run-er-tests.ts` - Helper script to run setup and tests in sequence
- `the_nyx_weave.ts` - Original comprehensive test suite
- `deposit-test-helper.ts` - Helper functions for deposit testing

## Prerequisites

1. **Setup Devnet Environment**: The tests require a properly configured devnet environment with keypairs and program state.

2. **Account Funding**: The setup script automatically funds all test accounts:
   - Main accounts (deployer, admin, ammWallet) get SOL airdrops
   - Test users (testUser1-5) get pre-funded with USDC (10K-30K each)
   - Unauthorized user for negative test cases
   - No manual funding required

3. **Dependencies**: Ensure all dependencies are installed:
   ```bash
   npm install
   ```

4. **Anchor Setup**: Make sure Anchor is properly configured for devnet testing.

## Running the Tests

### Option 1: Full Setup and Test (Recommended)
This will run the setup script first, then execute the tests:
```bash
npm run test:er:full
```

### Option 2: Manual Setup and Test
1. First, run the setup script:
   ```bash
   npm run setup:devnet
   ```

2. Then run the ER delegation tests:
   ```bash
   npm run test:er
   ```

### Option 3: Direct Anchor Test
```bash
anchor test tests/er-delegation-commit.ts
```

## Test Structure

The test suite includes the following test cases:

### Core ER Tests
- **TEST 6**: Delegating Strategy Vault
- **TEST 7**: Commit Arbitrage Without Undelegating
- **TEST 8**: Commit Arbitrage And Undelegate From ER

### Additional Functionality Tests
- **TEST 9**: User Deposit and Withdrawal
- **TEST 10**: Execute Arbitrage Mock
- **TEST 11**: Claim Profits

## Keypairs and State

The tests automatically load keypairs and program state from the setup script:
- `deployer-keypair.json` - Main deployer wallet
- `admin-keypair.json` - Admin wallet for program operations
- `amm-wallet.json` - AMM wallet for arbitrage operations
- `test-user-1.json` through `test-user-5.json` - Test user wallets with pre-funded USDC
- `unauthorized-user.json` - Unauthorized user for negative test cases
- `nyx_state.json` - Program state including USDC mint and vault addresses

## Environment Variables

The tests use the following environment variables for ER connection:
- `PROVIDER_ENDPOINT` - ER provider endpoint (default: https://devnet.magicblock.app/)
- `WS_ENDPOINT` - ER WebSocket endpoint (default: wss://devnet.magicblock.app/)

## Troubleshooting

### Common Issues

1. **Keypairs not found**: Run the setup script first
   ```bash
   npm run setup:devnet
   ```

2. **Insufficient SOL**: The tests skip airdrops to avoid rate limiting. Ensure accounts have sufficient SOL for testing
   ```bash
   # Fund accounts manually (one at a time to avoid rate limits)
   solana airdrop 2 <USER_PUBKEY> --url devnet
   ```

3. **Program not deployed**: Ensure the program is deployed to devnet and the program ID is correct

4. **Connection issues**: Check your internet connection and devnet endpoint availability

5. **429 Rate Limit Errors**: If you encounter rate limit errors, wait a few minutes between operations or use different RPC endpoints

### Debug Mode

To run tests with more verbose output:
```bash
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com anchor test tests/er-delegation-commit.ts -- --verbose
```

## Test Output

The tests will output:
- Transaction hashes for each operation
- Account balances and state changes
- Error messages for failed operations
- Commitment signatures for ER operations

## Contributing

When adding new tests:
1. Follow the existing naming convention (TEST X ::: Description)
2. Include proper error handling
3. Add descriptive console.log statements
4. Update this README if adding new test categories 