//This file will contain the StrategyVault struct. This account is central to the arbitrage execution, holding the working capital and tracking trade performance

use anchor_lang::prelude::*;

/// Strategy vault for managing trading capital and strategy parameters
/// Each vault represents a specific trading strategy with its own risk profile
#[account]
#[derive(InitSpace)]
pub struct StrategyVault {
    /// The token mint used for deposits in this strategy
    /// Determines which token can be deposited and traded
    pub deposit_token_mint: Pubkey,
    
    /// Total amount of tokens deposited into this strategy
    /// Tracks the total capital available for trading
    pub total_deposits: u64,
    
    /// Timestamp when the strategy was created
    /// Useful for tracking strategy performance over time
    pub created_at: i64,
    
    /// Risk level of the strategy (higher = more aggressive)
    /// Determines trading parameters and risk tolerance
    pub risk_level: u8,
    
    /// Whether the strategy is currently active
    /// Inactive strategies cannot accept new deposits
    pub is_active: bool,
    
    /// Whether the strategy is currently delegated to a trading bot
    /// Prevents withdrawals during active trading sessions
    pub is_delegated: bool,
    
    /// This account's bump seed for PDA verification
    pub strategy_vault_bump: u8,
}