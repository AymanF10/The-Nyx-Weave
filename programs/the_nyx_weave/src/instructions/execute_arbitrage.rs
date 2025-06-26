use anchor_lang::prelude::*;
use anchor_spl::{
token_interface::{Mint, TokenAccount, TransferChecked, transfer_checked, TokenInterface}
};

use crate::state::{DepositorAccount, GlobalConfig,  StrategyVault, TreasuryVault};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct ExecuteArbitrage<'info> {

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub deposit_token: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,


    #[account(mut)]
    pub strategy_vault: Account<'info, StrategyVault>,

    #[account(mut)]
    pub depositor_account: Account<'info, DepositorAccount>,

    #[account(
        seeds = [b"treasury_vault"],
        bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    #[account(
        mut,
        constraint = treasury_vault_token_account.mint == deposit_token.key() @ ErrorCode::InvalidMint,
        constraint = treasury_vault_token_account.owner == treasury_vault.key() @ ErrorCode::InvalidOwner,
    )]
    pub treasury_vault_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = strategy_vault_token_account.mint == deposit_token.key() @ ErrorCode::InvalidMint,
        constraint = strategy_vault_token_account.owner == strategy_vault.key() @ ErrorCode::InvalidOwner,
    )]
    pub strategy_vault_token_account: InterfaceAccount<'info, TokenAccount>,
   
    #[account(mut)]
    pub global_config: Account<'info, GlobalConfig>,

    pub token_program: Interface<'info, TokenInterface>,

    pub system_program: Program<'info, System>,
}


pub fn execute_arbitrage(ctx: Context<ExecuteArbitrage>, risk_level: u8) -> Result<()> {

    // TODO: get profit from arbitrage, currently hardcoded for testing purposes
    transfer_profit(ctx, risk_level, 100000000)?;
    Ok(())
}


// transfer profits from strategy vault to treasury vault, decide on delegation or later
pub fn transfer_profit(ctx: Context<ExecuteArbitrage>, risk_level: u8, user_swap_profit: u64) -> Result<()> {

    let strategy_vault_info = &mut ctx.accounts.strategy_vault;
    let depositor_account = &mut ctx.accounts.depositor_account;

    depositor_account.net_profit = depositor_account.net_profit.checked_add(user_swap_profit).ok_or(ErrorCode::ArithmeticOverflow)?;


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
                mint: ctx.accounts.deposit_token.to_account_info(),
            },
            &[vault_authority_seeds],
        ),
        user_swap_profit,
        ctx.accounts.deposit_token.decimals,
    )?;

    emit!(ProfitTransferredEvent {
        depositor: ctx.accounts.depositor.key(),
        deposit_token: ctx.accounts.deposit_token.key(),
        amount: user_swap_profit,
        timestamp: Clock::get()?.unix_timestamp,
    });


    return Ok(());
}


#[event]
pub struct ProfitTransferredEvent {
    pub depositor: Pubkey,
    pub deposit_token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}