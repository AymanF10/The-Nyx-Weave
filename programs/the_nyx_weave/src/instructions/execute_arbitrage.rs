use anchor_lang::prelude::*;
use cpi_example::dlmm_cpi::dlmm_swap::handle_dlmm_swap;
use cpi_example::dlmm_cpi::dlmm_swap::DlmmSwap;
use cpi_example::dlmm_cpi::dlmm_swap::DlmmSwapBumps;


#[derive(Accounts, AnchorSerialize, AnchorDeserialize)]
pub struct ExecuteArbitrage<'info> {
    #[account()]
    pub pool_a: DlmmSwap<'info>, // Buy from lower-priced pool
    #[account()]
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
