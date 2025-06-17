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
        ctx: Context<WithdrawFromTreasury>,
        mint: Pubkey,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.withdraw_token_from_treasury(mint, amount)
    }

    pub fn withdraw_all_tokens_from_treasury(
        ctx: Context<WithdrawFromTreasury>,
    ) -> Result<()> {
        ctx.accounts.withdraw_all_tokens_from_treasury()
    }

    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        strategy_vault_bump: u8,
        // Schedule parameters
        frequency_sec: u64,
        duration_sec: u64,
        // Token parameters
        deposit_token_mint: Pubkey,
        hedged_token_mint: Pubkey,
        percentage_hedge_bps: u64,
        // AMM parameters
        buy_amm_key: Pubkey,
        sell_amm_key: Pubkey,
        // Risk parameters (optional with defaults)
        stop_loss_limit: Option<u64>,
        price_range: Option<u64>,
        back_off_delay: Option<u64>,
        back_off_retry: Option<u64>,
    ) -> Result<()> {
        ctx.accounts.create_strategy(
            strategy_vault_bump,
            frequency_sec,
            duration_sec,
            deposit_token_mint,
            hedged_token_mint,
            percentage_hedge_bps,
            buy_amm_key,
            sell_amm_key,
            stop_loss_limit,
            price_range,
            back_off_delay,
            back_off_retry,
        )
    }




}
