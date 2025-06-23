// This will define the GlobalConfig struct. Its purpose is to hold platform-wide, administrative parameters like the admin key, fee_bps, and max_retries

use anchor_lang::prelude::*;

/// Global configuration for the Intra-Pool Arbitrage Platform
/// Controls platform-wide parameters and administrative settings
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    /// Platform fee percentage in basis points (0.01% increments)
    /// Allows flexible fee adjustment without code modifications
    pub fee_bps: u64,

    /// The authority that can update this config and manage the platform
    pub admin: Pubkey,
    
    /// Maximum number of transaction retry attempts
    /// Provides configurable resilience for trade execution
    pub max_retries: u8,
    
    /// Minimum profit threshold for executing trades
    /// Prevents executing trades with negligible returns
    pub min_profit_threshold: u64,
    
    /// This account's bump seed for verification
    pub global_config_bump: u8,
}