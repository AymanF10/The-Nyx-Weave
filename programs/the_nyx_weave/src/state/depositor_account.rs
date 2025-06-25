//This file will define the struct for the unique PDA created for each depositor

use anchor_lang::prelude::*;

/// Account tracking individual user deposits in the platform
/// Maintains deposit history and balances for a specific user
#[account]
#[derive(InitSpace)]
pub struct DepositorAccount {
    /// The public key of the depositor who owns this account
    /// Used for verification and attribution of deposits
    pub depositor: Pubkey,
    
    /// Total amount of tokens deposited by this user
    /// Tracks the user's total contribution to the strategy
    pub total_amount_deposited: u64,

    /// Total amount of profits accumulated for this user
    /// Tracks the user's total profits from the strategy
    pub net_profit: u64,
    
    /// Timestamp of the user's most recent deposit
    /// Useful for analytics and time-based features
    pub last_deposit_time: i64,

    
    /// This account's bump seed for PDA verification
    pub depositor_bump: u8,
}