use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
token_interface::{Mint, TokenAccount, TransferChecked, transfer_checked, TokenInterface}
};

use crate::state::{DepositorAccount, /*GlobalConfig,*/ StrategyVault};
use crate::error::ErrorCode;

/// Accounts required for depositing and withdrawing funds
/// Handles user interactions with strategy vaults
#[derive(Accounts)]
#[instruction(risk_level: u8)]
pub struct UserDeposit<'info> {
    /// The user making the deposit or withdrawal
    /// Signs the transaction and pays for any account creation
    #[account(mut)]
    pub depositor: Signer<'info>,

    /// The token mint being deposited or withdrawn
    /// Must match the strategy vault's deposit token
    #[account(
        //constraint = deposit_token.key() == token_to_deposit @ErrorCode::TokenMismatch,
    )]
    pub deposit_token: InterfaceAccount<'info, Mint>,

    /// The user's token account
    /// Source for deposits and destination for withdrawals
    #[account(
        mut,
        constraint = depositor_token_account.owner == depositor.key() @ ErrorCode::InvalidOwner,
        constraint = depositor_token_account.mint == deposit_token.key() @ ErrorCode::InvalidMint,
    )]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    /// The account tracking this user's deposits
    /// Created if this is the user's first deposit
    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + DepositorAccount::INIT_SPACE,
        // todo!() prolly needs to tie depositor_account to risk level so user can deposit into many
        // todo!() risk levels.... might not be needed as deposit_token is unique across each strategy vault
        seeds = [b"depositor", depositor.key().as_ref(), deposit_token.key().as_ref()],
        bump,
    )]
    pub depositor_account: Account<'info, DepositorAccount>,

    /// The strategy vault receiving the deposit or processing the withdrawal
    /// Must be active for deposits and not delegated for withdrawals
    #[account(
        mut,
        seeds = [b"strategy_vault", deposit_token.key().as_ref(), &risk_level.to_be_bytes()],
        bump = strategy_vault.strategy_vault_bump,
        constraint = strategy_vault.deposit_token_mint == deposit_token.key() @ ErrorCode::InvalidMint,
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    /// The token account owned by the strategy vault
    /// Destination for deposits and source for withdrawals
    #[account(
        mut,
        constraint = vault_token_account.mint == deposit_token.key() @ ErrorCode::InvalidMint,
        constraint = vault_token_account.owner == strategy_vault.key() @ ErrorCode::InvalidOwner,
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Required for token operations
    pub token_program: Interface<'info, TokenInterface>,

    /// Required for creating associated token accounts
    pub associated_token_program: Program<'info, AssociatedToken>,

    /// Required by Solana for creating new accounts
    pub system_program: Program<'info, System>,
}

// Implementation of the user deposit instruction
// This function handles the logic for depositing tokens into the platform
pub fn create_deposit(ctx: Context<UserDeposit>, risk_level: u8, amount: u64) -> Result<()> {
    
    let depositor_account_info = &mut ctx.accounts.depositor_account;
    let strategy_vault_info = &mut ctx.accounts.strategy_vault;
    
    require!(strategy_vault_info.is_active == true, ErrorCode::InactiveStrategy);
    
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.depositor_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
                mint: ctx.accounts.deposit_token.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.deposit_token.decimals,
    )?;

    depositor_account_info.depositor = ctx.accounts.depositor.key();
    depositor_account_info.total_amount_deposited = depositor_account_info
        .total_amount_deposited
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    depositor_account_info.last_deposit_time = Clock::get()?.unix_timestamp;
    depositor_account_info.depositor_bump = ctx.bumps.depositor_account;
    
    strategy_vault_info.total_deposits = strategy_vault_info.total_deposits
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    emit!(DepositEvent {
        depositor: ctx.accounts.depositor.key(),
        deposit_token: ctx.accounts.deposit_token.key(),
        amount: amount,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}


pub fn withdraw(ctx: Context<UserDeposit>, risk_level: u8, amount: u64) -> Result<()> {
    let strategy_vault_info = &mut ctx.accounts.strategy_vault;
    let depositor_account_info = &mut ctx.accounts.depositor_account;
    
    require!(strategy_vault_info.is_delegated == false, ErrorCode::VaultInDelegation);

    require!(
        depositor_account_info.total_amount_deposited >= amount,
        ErrorCode::InsufficientFunds
    );
    
    require!(
        ctx.accounts.vault_token_account.amount >= amount,
        ErrorCode::InsufficientFunds
    );
    
    depositor_account_info.total_amount_deposited = depositor_account_info.total_amount_deposited
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticUnderflow)?;
    
    let vault_authority_seeds = &[
        b"strategy_vault",
        strategy_vault_info.deposit_token_mint.as_ref(),
        &risk_level.to_be_bytes(),
        &[strategy_vault_info.strategy_vault_bump],
    ];
    
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.depositor_token_account.to_account_info(),
                authority: strategy_vault_info.to_account_info(),
                mint: ctx.accounts.deposit_token.to_account_info(),
            },
            &[vault_authority_seeds],
        ),
        amount,
        ctx.accounts.deposit_token.decimals,
    )?;
    
    strategy_vault_info.total_deposits = strategy_vault_info.total_deposits
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticUnderflow)?;
    
    emit!(WithdrawEvent {
        depositor: ctx.accounts.depositor.key(),
        withdraw_token: ctx.accounts.deposit_token.key(),
        amount: amount,
        withdrawal_time: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

/// Event emitted when a user makes a deposit
/// Records deposit details for transparency and tracking
#[event]
pub struct DepositEvent {
    /// The user who made the deposit
    pub depositor: Pubkey,
    
    /// The token mint that was deposited
    pub deposit_token: Pubkey,
    
    /// The amount of tokens deposited
    pub amount: u64,
    
    /// Timestamp when the deposit was made
    pub timestamp: i64,
}

/// Event emitted when a user makes a withdrawal
/// Records withdrawal details for transparency and tracking
#[event]
pub struct WithdrawEvent {
    /// The user who made the withdrawal
    pub depositor: Pubkey,
    
    /// The token mint that was withdrawn
    pub withdraw_token: Pubkey,
    
    /// The amount of tokens withdrawn
    amount: u64,
    
    /// Timestamp when the withdrawal was made
    withdrawal_time: i64,
}