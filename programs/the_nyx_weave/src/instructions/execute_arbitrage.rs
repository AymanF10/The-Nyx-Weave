// https://github.com/coral-xyz/anchor/issues/3401#issuecomment-2513466441
#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use cpi_example::dlmm_cpi::dlmm_swap::*;

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    pub pool_a: DlmmSwap<'info>, // Buy from lower-priced pool
    pub pool_b: DlmmSwap<'info>, // Sell to higher-priced pool
    #[account(mut)]
    pub user: Signer<'info>,
}


pub fn execute_arbitrage(
    ctx: Context<ExecuteArbitrage>,
    amount_in: u64,
    min_amount_out_a: u64,
    min_amount_out_b: u64,
) -> Result<()> {
    // First swap: Buy from Pool A
    handle_dlmm_swap(
        Context::new(
            ctx.program_id,
            &mut ctx.accounts.pool_a,
            ctx.remaining_accounts,
            DlmmSwapBumps
        ),
        amount_in,
        min_amount_out_a,
    )?;

    // Second swap: Sell to Pool B
    handle_dlmm_swap(
        Context::new(
            ctx.program_id,
            &mut ctx.accounts.pool_b,
            ctx.remaining_accounts,
            DlmmSwapBumps
        ),
        min_amount_out_a, // Use output from first swap as input
        min_amount_out_b,
    )?;

    Ok(())
}
