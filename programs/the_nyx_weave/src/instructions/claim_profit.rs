use anchor_lang::prelude::*;
use anchor_spl::{
token_interface::{Mint, TokenAccount, TransferChecked, transfer_checked, TokenInterface}
};

use crate::state::{DepositorAccount, GlobalConfig,  StrategyVault, TreasuryVault};
use crate::error::ErrorCode;


#[derive(Accounts)]
#[instruction(risk_level: u8)]
//user claims profit from treasury vault
pub struct ClaimProfit<'info> {

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut)]
    pub deposit_token: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub depositor_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"strategy_vault", deposit_token.key().as_ref(), &risk_level.to_be_bytes()],
        bump = strategy_vault.strategy_vault_bump,
        constraint = strategy_vault.deposit_token_mint == deposit_token.key() @ ErrorCode::InvalidMint,
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    #[account(
        seeds = [b"treasury_vault"],
        bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    #[account(
        seeds = [b"depositor", depositor.key().as_ref(), deposit_token.key().as_ref(), strategy_vault.key().as_ref()],
        bump,
    )]
    pub depositor_account: Account<'info, DepositorAccount>,

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

pub fn claim_profit(ctx: Context<ClaimProfit>) -> Result<()> {

    let deposit_token = &mut ctx.accounts.deposit_token;
    let treasury_vault = &mut ctx.accounts.treasury_vault;
    let depositor_token_account = &mut ctx.accounts.depositor_token_account;
    let treasury_vault_token_account = &mut ctx.accounts.treasury_vault_token_account;
    let token_program = &mut ctx.accounts.token_program;
    let treasury_vault_bump = treasury_vault.treasury_vault_bump;
    let depositor_account = &mut ctx.accounts.depositor_account;
    let strategy_vault = &mut ctx.accounts.strategy_vault;

    let treasury_vault_authority_seeds: &[&[u8]] = &[
    b"treasury_vault",
    &[treasury_vault_bump],
    ];

    // calculate user's share of profit
    let user_share = strategy_vault.total_deposits.checked_div(depositor_account.total_amount_deposited).ok_or(ErrorCode::ArithmeticOverflow)?;

    let profit_amount = user_share.checked_mul(strategy_vault.total_profit).ok_or(ErrorCode::ArithmeticOverflow)?;

    let signer_seeds: &[&[&[u8]]] = &[treasury_vault_authority_seeds];

    transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: treasury_vault_token_account.to_account_info(),
                to: depositor_token_account.to_account_info(),   
                mint: deposit_token.to_account_info(),
                authority: treasury_vault.to_account_info(),
            },
            signer_seeds,
        ),
        profit_amount,
        deposit_token.decimals,
    )?;

    Ok(())
}




#[event]
pub struct ProfitClaimedEvent {
    pub depositor: Pubkey,
    pub deposit_token: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

