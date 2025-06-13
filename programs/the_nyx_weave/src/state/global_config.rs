// This will define the GlobalConfig struct. Its purpose is to hold platform-wide, administrative parameters like the admin key, fee_bps, and max_retries
use anchor_lang::prelude::*;

#[account]
#[derive(Debug,InitSpace)]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub fee_bps: u16,
    pub max_retries: u8,
    pub bump: u8,
}

impl GlobalConfig {
    pub const SIZE: usize = 32 + 2 + 1;
}