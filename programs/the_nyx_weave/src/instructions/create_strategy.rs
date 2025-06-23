use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken ,token_interface::{Mint, TokenAccount, TokenInterface}};

use crate::state::{GlobalConfig, StrategyVault, Administrator};
use crate::error::ErrorCode;

/// Accounts required for creating a new trading strategy
/// Sets up a strategy vault with specific risk parameters
#[derive(Accounts)]
#[instruction(risk_level: u8)]
pub struct CreateStrategy<'info> {
    /// The admin creating the strategy
    /// Must be in the administrators list
    #[account(
        mut,
        constraint = admins.administrators.contains(&admin.key()) @ErrorCode::OnlyAdmin,
    )]
    pub admin: Signer<'info>,

    /// The administrator account containing authorized admins
    /// Used to verify the signer has admin privileges
    #[account(
        mut,
        seeds = [b"administrators"],
        bump = admins.administrators_bump,
    )]
    pub admins: Account<'info, Administrator>,

    /// The global configuration account
    /// Contains platform-wide settings
    #[account(
        seeds = [b"global_config"],
        bump = global_config.global_config_bump,
        constraint = global_config.admin == admin.key() @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// The token mint that will be used for this strategy
    /// Determines which token can be deposited and traded
    pub deposit_token_mint: InterfaceAccount<'info, Mint>,

    /// The strategy vault account being created
    /// Stores strategy-specific parameters and state
    #[account(
        init,
        payer = admin,
        space = 8 + StrategyVault::INIT_SPACE,
        seeds = [b"strategy_vault", deposit_token_mint.key().as_ref(), &risk_level.to_be_bytes()],
        bump,// !note will be delegated to ER
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    /// The token account owned by the strategy vault
    /// Holds deposited tokens for trading
    #[account(
        init,
        payer = admin,
        associated_token::mint = deposit_token_mint,
        associated_token::authority = strategy_vault,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Required for token operations
    pub token_program: Interface<'info, TokenInterface>,
    
    /// Required for creating associated token accounts
    pub associated_token_program: Program<'info, AssociatedToken>,
    
    /// Required by Solana for creating new accounts
    pub system_program: Program<'info, System>,
}

/// Initialize a new trading strategy with specified risk level
/// Creates a strategy vault and associated token account
pub fn init_strategy(
    ctx: Context<CreateStrategy>,
    risk_level: u8,
) -> Result<()> {
    
    let strategy_vault_info = &mut ctx.accounts.strategy_vault;
    strategy_vault_info.set_inner(StrategyVault {
        deposit_token_mint: ctx.accounts.deposit_token_mint.key(),
        total_deposits: 0,
        created_at: Clock::get()?.unix_timestamp,
        risk_level,
        is_active: true,
        is_delegated: false,
        strategy_vault_bump: ctx.bumps.strategy_vault
    });

    emit!(StrategyCreatedEvent {
        strategy_vault: ctx.accounts.strategy_vault.key(),
        deposit_token_mint: ctx.accounts.deposit_token_mint.key(),
        risk_level: risk_level,
        created_at: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

/// Event emitted when a new strategy is created
/// Records the strategy parameters and creation time
#[event]
pub struct StrategyCreatedEvent {
    /// The public key of the created strategy vault
    pub strategy_vault: Pubkey,
    
    /// The token mint used for this strategy
    pub deposit_token_mint: Pubkey,
    
    /// The risk level of the strategy
    pub risk_level: u8,
    
    /// Timestamp when the strategy was created
    pub created_at: i64,
}