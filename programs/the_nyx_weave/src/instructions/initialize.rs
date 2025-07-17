use anchor_lang::prelude::*;
use crate::state::*;
use crate::error::ErrorCode;

/// Accounts required for initializing the administrator account
/// Sets up the first admin who can perform privileged operations
#[derive(Accounts)]
pub struct AdminInfo<'info> {
    /// The deployer who is creating the admin account
    /// Pays for the transaction and account creation
    #[account(mut)]
    pub deployer: Signer<'info>,

    /// The administrator account being initialized
    /// Stores the list of authorized admin public keys
    #[account(
        init,
        payer = deployer,
        space = 8 + Administrator::INIT_SPACE,
        seeds = [b"administrators"],
        bump,
    )]
    pub admin: Account<'info, Administrator>,

    /// Required by Solana for creating new accounts
    pub system_program: Program<'info, System>,
}

/// Accounts required for initializing the platform configuration
/// Sets up global settings and the treasury vault
#[derive(Accounts)]
pub struct Initialize<'info> {
    /// The admin initializing the platform
    /// Must be in the administrators list
    #[account(
        mut,
        constraint = administrators.administrators.contains(&admin.key()) @ErrorCode::OnlyAdmin,
    )]
    pub admin: Signer<'info>,

    /// The administrator account containing authorized admins
    /// Used to verify the signer has admin privileges
    #[account(
        mut,
        seeds = [b"administrators"],
        bump = administrators.administrators_bump,
    )]
    pub administrators: Account<'info, Administrator>,

    /// The global configuration account being initialized
    /// Stores platform-wide parameters
    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config"],
        bump,
    )]
    pub global_config: Account<'info, GlobalConfig>,

    /// The treasury vault account being initialized
    /// Manages platform profits and distributions
    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryVault::INIT_SPACE,
        seeds = [b"treasury_vault"],
        bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    /// Required by Solana for creating new accounts
    pub system_program: Program<'info, System>,
}

/// Initialize the administrator account with the first admin
/// This function must be called before other initialization steps
pub fn initialize_administrators(ctx: Context<AdminInfo>, admin_pubkey: Pubkey) -> Result<()> {
    let administrator_info = &mut ctx.accounts.admin;
    
    if !administrator_info.administrators.contains (&admin_pubkey) {
        administrator_info.administrators.push(admin_pubkey);
        administrator_info.administrators_bump = ctx.bumps.admin;
    }
    
    Ok(())
}

pub fn update_admin(ctx: Context<AdminInfo>, admin_pubkey: Pubkey) -> Result<()> {
    let admin_info = &mut ctx.accounts.admin;
    admin_info.administrators.push(admin_pubkey);
    admin_info.administrators_bump = ctx.bumps.admin;
    Ok(())
}

/// Initialize the global configuration and treasury vault
/// Sets up platform parameters and creates the treasury account
pub fn initialize_config_treasury(ctx: Context<Initialize>, fee_bps: u64, min_profit_threshold: u64, max_retries: u8) -> Result<()> {
    require!(fee_bps <= 10000, ErrorCode::InvalidParameter);
    require!(max_retries <= 3, ErrorCode::InvalidParameter);
    
    let global_config = &mut ctx.accounts.global_config;
    global_config.admin = ctx.accounts.admin.key();
    global_config.fee_bps = fee_bps;
    global_config.min_profit_threshold = min_profit_threshold;
    global_config.max_retries = max_retries;
    global_config.global_config_bump = ctx.bumps.global_config;

    let treasury_vault_info = &mut ctx.accounts.treasury_vault;
    treasury_vault_info.set_inner(TreasuryVault {
        total_profits_secured: 0,
        treasury_admin: ctx.accounts.admin.key(),// todo!() for now, one admin for all privileged actions
        total_profits_distributed: 0,
        last_distribution_time: 0,
        treasury_vault_bump: ctx.bumps.treasury_vault
    });
    
    emit!(InitializeEvent {
        admin: ctx.accounts.admin.key(),
        fee_bps,
        min_profit_threshold,
        max_retries,
    });
    
    Ok(())
}

/// Event emitted when the platform is initialized
/// Records the initial configuration parameters
#[event]
pub struct InitializeEvent {
    /// The admin who initialized the platform
    pub admin: Pubkey,
    
    /// The initial fee percentage in basis points
    pub fee_bps: u64,
    
    /// The initial minimum profit threshold
    pub min_profit_threshold: u64,
    
    /// The initial maximum retry count
    pub max_retries: u8,
}
