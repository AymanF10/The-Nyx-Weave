pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2N1TRSvQTNxH52mhqbgn3XShtXZuPQoaAk1puGw2uJeF");

#[program]
pub mod the_nyx_weave {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        fee_bps: u16,
        max_retries: u8,
    ) -> Result<()> {
        ctx.accounts.initialize_treasury_and_config(
            ctx.bumps.global_config,
            ctx.bumps.treasury_vault,
            fee_bps,
            max_retries,
        )
    }

    pub fn withdraw_from_treasury(
        ctx: Context<WithdrawDepositTreasury>,
        mint: Pubkey,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.withdraw_token_from_treasury(mint, amount)
    }

    pub fn deposit_to_treasury(
        ctx: Context<WithdrawDepositTreasury>,
        mint: Pubkey,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.deposit_token_to_treasury(mint, amount)
    }

    pub fn withdraw_all_tokens_from_treasury(
        ctx: Context<WithdrawDepositTreasury>,
    ) -> Result<()> {
        ctx.accounts.withdraw_all_tokens_from_treasury()
    }




}
