/// Seeds used for PDA derivation in the platform
/// These ensure deterministic account addresses for program-owned accounts
pub const GLOBAL_CONFIG_SEED: &[u8] = b"global_config";
pub const TREASURY_SEED: &[u8] = b"treasury";
pub const STRATEGY_VAULT_SEED: &[u8] = b"strategy_vault";
pub const STRATEGY_AUTHORITY_SEED: &[u8] = b"strategy_authority";
pub const DEPOSITOR_SEED: &[u8] = b"depositor";
pub const TREASURY_AUTHORITY_SEED: &[u8] = b"treasury_authority";

/// Platform-wide constant values for fees and thresholds
/// Basis points (BPS) are used for percentage calculations (1 BPS = 0.01%)
pub const MAX_BPS: u64 = 10000; // 100%
pub const DEFAULT_FEE_BPS: u64 = 50; // 0.5%
pub const DEFAULT_MIN_PROFIT_THRESHOLD: u64 = 10000; // 0.00001 SOL in lamports
pub const DEFAULT_JITO_TIP: u64 = 10000; // 0.00001 SOL in lamports
pub const DEFAULT_MAX_RETRIES: u8 = 3;

/// Constants for account size calculations
/// Used to determine space allocation for various account types
pub const DISCRIMINATOR_LENGTH: usize = 8;
pub const PUBLIC_KEY_LENGTH: usize = 32;
pub const U64_LENGTH: usize = 8;
pub const U8_LENGTH: usize = 1;
pub const I64_LENGTH: usize = 8;
pub const BOOL_LENGTH: usize = 1;

