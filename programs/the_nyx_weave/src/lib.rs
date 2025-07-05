use anchor_lang::prelude::*;
/// Import the ephemeral rollups SDK which allows for improved efficiency in certain Solana transaction types
/// Enables optimized transaction processing for arbitrage operations
use ephemeral_rollups_sdk::anchor::ephemeral;


pub mod constants;   
pub mod error;        
pub mod instructions;
pub mod state;        

pub use constants::*;
pub use state::*;
pub use instructions::*;
pub use error::*;

declare_id!("2N1TRSvQTNxH52mhqbgn3XShtXZuPQoaAk1puGw2uJeF");

#[program]
pub mod the_nyx_weave {
    use super::*;

    /// Initialize the administrator account with the first admin
    /// This must be called before other initialization steps
    pub fn init_admins(ctx: Context<AdminInfo>, admin_pubkey: Pubkey) -> Result<()> {
        instructions::initialize_administrators(ctx, admin_pubkey)?;
        Ok(())
    }

    /// Initialize the platform by creating the global configuration account
    /// This is the first instruction that must be called before using the platform
    pub fn init_config_treasury(
        ctx: Context<Initialize>,
        fee_bps: u64,
        min_profit_threshold: u64,    
        max_retries: u8         
    ) -> Result<()> {
        instructions::initialize_config_treasury(
            ctx, 
            fee_bps, 
            min_profit_threshold, 
            max_retries
        )?;

        Ok(())
    }

    /// Create a new trading strategy with specified parameters
    /// Each strategy has its own risk profile and capital pool
    pub fn create_strategy(
        ctx: Context<CreateStrategy>,
        risk_level: u8,
    ) -> Result<()> {
        instructions::init_strategy(
            ctx,
            risk_level
        )?;

        Ok(())
    }

    pub fn user_deposit(ctx: Context<UserDeposit>, risk_level: u8, amount: u64) -> Result<()> {
        instructions::create_deposit(ctx, risk_level, amount)?;

        Ok(())
    }

    /// Allow users to withdraw their funds from a strategy
    pub fn user_withdraw(ctx: Context<UserDeposit>, risk_level: u8, amount: u64) -> Result<()> {
        instructions::withdraw(ctx, risk_level, amount)?;
        
        Ok(())
    }

    pub fn claim_profit(ctx: Context<ClaimProfit>, risk_level: u8) -> Result<()> {
        instructions::claim_profit(ctx, risk_level)?;
     
        Ok(())
    }

    /// Execute an arbitrage operation for a given risk level
    /// This will transfer the profit from the strategy vault to the treasury vault
    /// and update the depositor account with the new profit
    pub fn execute_arbitrage_mock(ctx: Context<ExecuteArbitrageMock>, risk_level: u8, amount: u64) -> Result<()> {
        instructions::execute_arbitrage_mock(ctx, risk_level, amount)?;
        
        Ok(())
    }

}