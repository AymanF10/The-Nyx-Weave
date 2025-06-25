//This is the core instruction called by the off-chain Execution Bot. It will perform the atomic 2-leg swap, pulling capital from the StrategyVault and executing the trades via CPIs to the target DEXs
use anchor_lang::prelude::*;
use crate::{state::{DepositorAccount, StrategyVault}, transfer_profit};

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {

    #[account(mut)]
    pub strategy_vault: Account<'info, StrategyVault>,

    #[account(mut)]
    pub depositor_account: Account<'info, DepositorAccount>,
}




pub fn execute_arbitrage(ctx: Context<ExecuteArbitrage>) -> Result<()> {

    // transfer_profit(ctx, ctx.accounts.strategy_vault.risk_level, ctx.accounts.depositor_account.net_profit)?;

    Ok(())
}