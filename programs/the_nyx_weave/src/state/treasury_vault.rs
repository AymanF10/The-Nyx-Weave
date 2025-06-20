// This will define the TreasuryVault struct. As this PDA's critical function is to secure all profits on the base layer before distribution

use anchor_lang::prelude::*;

/// Treasury vault for managing platform profits and distributions
/// Centralizes profit collection and distribution to stakeholders
#[account]
#[derive(InitSpace)]
pub struct TreasuryVault {
    /// The admin public key authorized to manage treasury operations
    /// Controls profit distribution and treasury management
    pub treasury_admin: Pubkey,
    
    /// Total amount of profits secured by the platform
    /// Tracks all profits ever generated across all strategies
    pub total_profits_secured: u64,
    
    /// Total amount of profits distributed to stakeholders
    /// Tracks how much profit has been paid out
    pub total_profits_distributed: u64,
    
    /// Timestamp of the last profit distribution
    /// Used to schedule regular distributions
    pub last_distribution_time: i64,
    
    /// This account's bump seed for PDA verification
    pub treasury_vault_bump: u8,
}
