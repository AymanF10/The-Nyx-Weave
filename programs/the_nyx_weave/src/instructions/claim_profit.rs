//A dedicated instruction to move profits from the StrategyVault to the TreasuryVault immediately following a successful trade

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TransferChecked, transfer_checked, TokenInterface};
use anchor_lang::prelude::InterfaceAccount;
use crate::state::{GlobalConfig, StrategyVault, TreasuryVault};
use crate::error::ErrorCode;


// todo!() HANDLES CLAIM LOGIC LATER; NEEDS MORE RESEARCH
// This struct defines the accounts required for claiming profits from Treasury Vault
#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct ClaimProfit<'info> {
    // The depositor who is claiming profits
    #[account(mut)]
    pub depositor: Signer<'info>,

    /*  The global configuration account
    // Contains platform-wide settings and admin authority
    // Used to verify the admin's authority to transfer profits
    #[account(
        seeds = [b"global_config"],
        bump = global_config.bump,
        constraint = global_config.admin == admin.key() @ ErrorCode::Unauthorized,
    )]
    pub global_config: Account<'info, GlobalConfig>,*/

    // The token mint of the profit being transferred
    // Used to ensure all accounts are for the same token
    pub token_mint: InterfaceAccount<'info, Mint>,

    // The treasury vault is what would hold generated profits
    #[account(
        mut,
        seeds = [b"strategy_vault", token_mint.key().as_ref()],
        bump = strategy_vault.bump,
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    // The token account owned by the strategy vault PDA
    // This is where the profits currently reside
    #[account(
        mut,
        constraint = strategy_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
        constraint = strategy_token_account.owner == strategy_vault_authority.key() @ ErrorCode::InvalidOwner,
    )]
    pub strategy_token_account: InterfaceAccount<'info, TokenAccount>,

    // The PDA that has authority over the strategy vault token account
    // This PDA will sign for token transfers from the strategy vault
    /// CHECK: This is a PDA derived from the strategy vault
    #[account(
        seeds = [b"strategy_authority", strategy_vault.key().as_ref()],
        bump,
    )]
    pub strategy_vault_authority: UncheckedAccount<'info>,

    // The treasury vault that will receive the profits
    // This vault securely holds profits until they are distributed to depositors
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = global_config.treasury_bump,
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,

    // The token account owned by the treasury vault PDA
    // This is where the profits will be transferred to
    #[account(
        mut,
        constraint = treasury_token_account.mint == token_mint.key() @ ErrorCode::InvalidMint,
        constraint = treasury_token_account.owner == treasury_authority.key() @ ErrorCode::InvalidOwner,
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,

    // The PDA that has authority over the treasury token account
    // This PDA can sign for token transfers from the treasury
    /// CHECK: This is a PDA derived from the treasury vault
    #[account(
        seeds = [b"treasury_authority"],
        bump,
    )]
    pub treasury_authority: UncheckedAccount<'info>,

    // Required programs
    // The token program for token transfers
    pub token_program: Program<'info, Token2022>,
    // The system program for account operations
    pub system_program: Program<'info, System>,
}

// Implementation of the transfer profit instruction
// This function handles the logic for transferring profits to the treasury
pub fn handler(ctx: Context<TransferProfit>, amount: u64) -> Result<()> {
    // Get the current timestamp for recording the transfer time
    // This is used for tracking when profits are secured
    let current_time = Clock::get()?.unix_timestamp;
    
    // Check if the strategy vault has enough funds to transfer
    // This prevents transferring more than available
    // Important for preventing errors in token transfers
    require!(
        ctx.accounts.strategy_token_account.amount >= amount,
        ErrorCode::InsufficientFunds
    );
    
    // Get the strategy vault authority seeds for signing
    // These seeds are used to derive the PDA that can sign on behalf of the strategy vault
    // This allows the vault to authorize token transfers without requiring a private key
    let strategy_authority_seeds = &[
        b"strategy_authority",
        ctx.accounts.strategy_vault.to_account_info().key.as_ref(),
        &[ctx.bumps.strategy_vault_authority],
    ];
    
    // Transfer tokens from the strategy vault to the treasury using the token interface
    // This moves the profits to the treasury for later distribution
    // Using PDA signing to authorize the transfer from the strategy vault
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.strategy_token_account.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.strategy_vault_authority.to_account_info(),
                mint: ctx.accounts.token_mint.to_account_info(),
            },
            &[strategy_authority_seeds],
        ),
        amount,
        ctx.accounts.token_mint.decimals,
    )?;
    
    // Update the treasury vault's total profits secured
    // This tracks all profits ever secured by the platform
    // Using checked_add to prevent overflow errors
    ctx.accounts.treasury_vault.total_profits_secured = ctx.accounts.treasury_vault.total_profits_secured
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Update the treasury vault's last distribution time
    // This records when profits were last moved to the treasury
    // Used for tracking profit transfer activity
    ctx.accounts.treasury_vault.last_distribution_time = current_time;
    
    // Update the strategy vault's last trade profit
    // This records the profit from the most recent trade
    // Useful for analytics and performance tracking
    ctx.accounts.strategy_vault.last_trade_profit = amount as i64;
    
    // Increment the total successful trades counter
    // This tracks the number of profitable trades executed
    // Important for platform analytics and performance metrics
    ctx.accounts.treasury_vault.total_successful_trades = ctx.accounts.treasury_vault.total_successful_trades
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Emit an event for the profit transfer for transparency and tracking
    // This provides an on-chain record of the profit transfer
    // Can be used by frontends to show profit history
    emit!(ProfitTransferEvent {
        strategy_vault: ctx.accounts.strategy_vault.key(),
        treasury_vault: ctx.accounts.treasury_vault.key(),
        token_mint: ctx.accounts.token_mint.key(),
        amount: amount,
        timestamp: current_time,
    });
    
    Ok(())
}

// Event emitted when profits are transferred
// This creates an on-chain record of the profit transfer transaction
#[event]
pub struct ProfitTransferEvent {
    // The strategy vault from which profits were transferred
    // Indexed for efficient filtering in event queries
    pub strategy_vault: Pubkey,
    
    // The treasury vault that received the profits
    // Indexed for efficient filtering in event queries
    pub treasury_vault: Pubkey,
    
    // The token mint of the profits
    // Identifies which token was transferred
    pub token_mint: Pubkey,
    
    // The amount of profits transferred
    // Recorded in the token's native units
    pub amount: u64,
    
    // The timestamp when the transfer occurred
    // Unix timestamp in seconds
    pub timestamp: i64,
}