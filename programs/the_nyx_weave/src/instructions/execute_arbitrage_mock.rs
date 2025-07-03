use anchor_lang::prelude::*;
use anchor_spl::{
token_interface::{Mint, TokenAccount, TransferChecked, transfer_checked, TokenInterface}
};
use crate::state::{DepositorAccount, GlobalConfig,  StrategyVault, TreasuryVault};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct ExecuteArbitrageMock<'info> {

    #[account(mut)]
    pub amm_wallet: Signer<'info>,

    #[account(mut)]
    pub profit_token: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub strategy_vault: Account<'info, StrategyVault>,

    #[account(
        seeds = [b"treasury_vault"],
        bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,


    #[account(
        mut,
        constraint = amm_wallet_token_account.mint == profit_token.key() @ ErrorCode::InvalidMint,
        constraint = amm_wallet_token_account.owner == amm_wallet.key() @ ErrorCode::InvalidOwner,
    )]
    pub amm_wallet_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_vault_token_account.mint == profit_token.key() @ ErrorCode::InvalidMint,
        constraint = treasury_vault_token_account.owner == treasury_vault.key() @ ErrorCode::InvalidOwner,
    )]
    pub treasury_vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = strategy_vault_token_account.mint == profit_token.key() @ ErrorCode::InvalidMint,
        constraint = strategy_vault_token_account.owner == strategy_vault.key() @ ErrorCode::InvalidOwner,
    )]
    pub strategy_vault_token_account: InterfaceAccount<'info, TokenAccount>,
   
    #[account(mut)]
    pub global_config: Account<'info, GlobalConfig>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}


pub fn execute_arbitrage_mock(ctx: Context<ExecuteArbitrageMock>, risk_level: u8, amount: u64) -> Result<()> {

    // Transfer funds from mock amm wallet to strategy vault
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.amm_wallet_token_account.to_account_info(),
                to: ctx.accounts.strategy_vault_token_account.to_account_info(),
                authority: ctx.accounts.amm_wallet.to_account_info(),
                mint: ctx.accounts.profit_token.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.profit_token.decimals,
    )?;

    // accumulate profit in strategy vault
    let strategy_vault_info = &mut ctx.accounts.strategy_vault;
    strategy_vault_info.total_profit = strategy_vault_info.total_profit.checked_add(amount).ok_or(ErrorCode::ArithmeticOverflow)?;

    transfer_profit(ctx, risk_level, amount)?;

    Ok(())
}


// transfer profits from strategy vault to treasury vault, decide on delegation or later
pub fn transfer_profit(ctx: Context<ExecuteArbitrageMock>, risk_level: u8, profit_amount: u64) -> Result<()> {

    let strategy_vault_info = &mut ctx.accounts.strategy_vault;

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
                from: ctx.accounts.strategy_vault_token_account.to_account_info(),
                to: ctx.accounts.treasury_vault_token_account.to_account_info(),
                authority: strategy_vault_info.to_account_info(),
                mint: ctx.accounts.profit_token.to_account_info(),
            },
            &[vault_authority_seeds],
        ),
        profit_amount,
        ctx.accounts.profit_token.decimals,
    )?;

    emit!(ProfitTransferredEvent {
        amm_wallet: ctx.accounts.amm_wallet.key(),
        profit_token: ctx.accounts.profit_token.key(),
        amount: profit_amount,
        timestamp: Clock::get()?.unix_timestamp,
    });

    return Ok(());
}


#[event]
pub struct ProfitTransferredEvent {
    pub amm_wallet: Pubkey,
    pub profit_token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}