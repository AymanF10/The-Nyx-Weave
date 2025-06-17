// An administrative instruction to initialize a new StrategyVault. This allows for the future possibility of running multiple, concurrent arbitrage strategies, each with its own vault

use anchor_lang::prelude::*;

use crate::{error::NyxWeaveError, StrategyVault, STRATEGY_VAULT_SEED};

#[derive(Accounts)]
pub struct CreateStrategy<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + StrategyVault::INIT_SPACE,
        seeds = [STRATEGY_VAULT_SEED.as_bytes(), admin.key().as_ref()],
        bump
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    pub system_program: Program<'info, System>,
}

impl<'info> CreateStrategy<'info> {
    pub fn create_strategy(
        &mut self,
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
        require!(
            percentage_hedge_bps <= 10_000,
            NyxWeaveError::InvalidHedgePercentage
        );

        let stop_loss_limit = stop_loss_limit.unwrap_or(0); // 0 = no stop loss
        let price_range = price_range.unwrap_or(0); // 0 = no price range restriction
        let back_off_delay = back_off_delay.unwrap_or(5); // Default 5 seconds delay
        let back_off_retry = back_off_retry.unwrap_or(3); // Default 3 retries

        self.strategy_vault.set_inner(StrategyVault {
            total_capital: 0,
            bump: strategy_vault_bump,
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
            last_trade_profit: 0,
            total_trades_executed: 0,
        });

        Ok(())
    }

    pub fn close_strategy(&mut self) -> Result<()> {
        self.strategy_vault.close(self.admin.to_account_info())?;
        Ok(())
    }
}