use anchor_lang::prelude::*;

#[account]
#[derive(Debug,InitSpace)]
pub struct StrategyVault {
    // schedule
    pub frequency_sec: u64,
    pub duration_sec: u64,
   
    // AMM inputs
    pub deposit_token_mint: Pubkey,
    pub hedged_token_mint: Pubkey,
    pub percentage_hedge_bps:u64, // amount to hedge
    pub buy_amm_key: Pubkey,
    pub sell_amm_key: Pubkey,
   
    //risk (optional)
    pub stop_loss_limit: u64,
    pub price_range: u64,
    pub back_off_delay: u64,
    pub back_off_retry: u64,

    pub bump: u8,
    pub total_capital: u64,
    pub last_trade_profit: i64,
    pub total_trades_executed: u64,

   }
   