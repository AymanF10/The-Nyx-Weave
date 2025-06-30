use anchor_lang::prelude::*;
use crate::dlmm_cpi::handle_dlmm_swap;
use crate::dlmm_cpi::DlmmSwap;

/// Accounts required for arbitrage between two DLMM pools.
#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {
    // Accounts for the first swap (buy from lower-priced pool)
    #[account(mut)]
    pub pool_a: DlmmSwap<'info>,

    // Accounts for the second swap (sell to higher-priced pool)
    #[account(mut)]
    pub pool_b: DlmmSwap<'info>,

    // The user performing the arbitrage
    #[account(mut)]
    pub user: Signer<'info>,
}

/// Executes arbitrage by performing two sequential swaps:
/// 1. Buys token from Pool A (lower price)
/// 2. Sells token to Pool B (higher price)
///
/// # Arguments
/// * `ctx` - The context containing accounts and programs.
/// * `amount_in` - The amount of input tokens to use in the first swap.
/// * `min_amount_out_a` - The minimum amount of output tokens expected from the first swap.
/// * `min_amount_out_b` - The minimum amount of output tokens expected from the second swap.
///
/// # Returns
/// Returns a `Result` indicating success or failure.
pub fn execute_arbitrage<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, ExecuteArbitrage<'info>>,
    amount_in: u64,
    min_amount_out_a: u64,
    min_amount_out_b: u64,
) -> Result<()> {
    // Perform the first swap (buy from Pool A)
    handle_dlmm_swap(
        Context::new(
            ctx.program_id,
            &mut ctx.accounts.pool_a,
            ctx.remaining_accounts,
        ),
        amount_in,
        min_amount_out_a,
    )?;

    // Perform the second swap (sell to Pool B)
    handle_dlmm_swap(
        Context::new(
            ctx.program_id,
            &mut ctx.accounts.pool_b,
            ctx.remaining_accounts,
        ),
        min_amount_out_a, // Use output from first swap as input for second swap
        min_amount_out_b,
    )?;

    Ok(())
}
