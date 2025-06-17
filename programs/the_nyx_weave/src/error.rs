use anchor_lang::prelude::*;

/// Custom error codes for the Intra-Pool Arbitrage Platform
/// These provide specific error messages for various failure scenarios
#[error_code]
pub enum ErrorCode {
    /// Error when an account's owner is not as expected
    /// Prevents unauthorized operations on accounts
    #[msg("Invalid account owner: Operation not permitted")]
    InvalidOwner,

    /// Error when a non-admin attempts to call an admin-only instruction
    /// Enforces access control for privileged operations
    #[msg("Only Admin Can Call This Instruction")]
    OnlyAdmin,

    /// Error when token mints don't match in a transaction
    /// Ensures operations only occur between compatible tokens
    #[msg("Token Mint Are Different. Ensure Same")]
    TokenMismatch,

    /// Error when attempting to use a strategy vault that is disabled
    /// Prevents operations on inactive strategies
    #[msg("Specified Strategy Vault Is Disabled")]
    InactiveStrategy,

    /// Error when attempting to withdraw from a strategy during delegation
    /// Prevents withdrawals during active trading operations
    #[msg("Cannot Withdraw From Strategy Vault During Delegation")]
    VaultInDelegation,
    
    /// Error when an unauthorized user attempts a restricted operation
    /// Enforces access control throughout the platform
    #[msg("Unauthorized access: User lacks required permissions")]
    Unauthorized,

    /// Error when an account has insufficient funds for an operation
    /// Prevents operations that would result in negative balances
    #[msg("Insufficient funds for the requested operation")]
    InsufficientFunds,
    
    /// Error when a trade's profit is below the minimum threshold
    /// Prevents executing unprofitable or marginally profitable trades
    #[msg("Trade does not meet minimum profitability threshold")]
    ProfitTooLow,
    
    /// Error when price deviation exceeds safety parameters
    /// Protects against executing trades during extreme market volatility
    #[msg("Price deviation exceeds configured risk parameters")]
    PriceDeviationTooHigh,

    /// Error when an incorrect token mint is used
    /// Ensures operations only use the expected tokens
    #[msg("Invalid token mint: Operation cannot proceed")]
    InvalidMint,
    
    /// Error when a token transfer fails validation
    /// Indicates issues with the token transfer operation
    #[msg("Token transfer failed: Validation error")]
    TokenTransferFailed,

    /// Error when strategy configuration parameters are invalid
    /// Prevents creation of strategies with unsafe parameters
    #[msg("Invalid strategy configuration: Parameters out of acceptable range")]
    InvalidStrategyConfiguration,
    
    /// Error when attempting operations on an inactive strategy
    /// Prevents operations on strategies that are not currently active
    #[msg("Strategy is not currently active")]
    StrategyInactive,

    /// Error when an arithmetic operation would overflow
    /// Prevents numeric overflows that could lead to security issues
    #[msg("Arithmetic overflow detected: Calculation exceeds maximum value")]
    ArithmeticOverflow,
    
    /// Error when an arithmetic operation would underflow
    /// Prevents numeric underflows that could lead to security issues
    #[msg("Arithmetic underflow detected: Calculation below minimum value")]
    ArithmeticUnderflow,

    /// Error when a timestamp is invalid for an operation
    /// Enforces time-based constraints on operations
    #[msg("Invalid timestamp: Operation timing constraint violated")]
    InvalidTimestamp,
    
    /// Error when maximum retry attempts are exceeded
    /// Prevents infinite retry loops for failed operations
    #[msg("Maximum retry limit exceeded")]
    MaxRetriesExceeded,

    /// Error when an invalid parameter is provided
    /// Ensures all instruction parameters meet requirements
    #[msg("Invalid parameter provided: Value does not meet requirements")]
    InvalidParameter,

    /// Error when a vault has insufficient capital for an operation
    /// Prevents operations that require more funds than available
    #[msg("Vault is empty or has insufficient capital")]
    VaultEmpty,
    
    /// Error when account initialization fails
    /// Indicates issues during account creation
    #[msg("Account initialization failed")]
    AccountInitializationFailed,

    /// Error when an operation is not allowed in the current state
    /// Prevents operations that violate state transition rules
    #[msg("Operation not allowed in current state")]
    OperationNotAllowed,
}

