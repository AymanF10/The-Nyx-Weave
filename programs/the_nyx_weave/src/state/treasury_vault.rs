// This will define the TreasuryVault struct. As this PDA's critical function is to secure all profits on the base layer before distribution
use anchor_lang::prelude::*;

#[account]
#[derive(Debug,InitSpace)]

pub struct TreasuryVault {
    pub admin: Pubkey,
    pub total_profits_secured: u64,
    pub bump: u8,
}
