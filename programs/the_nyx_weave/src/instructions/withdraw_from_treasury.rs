
use anchor_lang::prelude::*;

use anchor_spl::{token::{Token}, token_interface::{transfer_checked, Mint, TokenAccount, TransferChecked}};

use crate::{ error::NyxWeaveError, state::GlobalConfig, TreasuryVault, TREASURY_VAULT_SEED, GLOBAL_CONFIG_SEED};


#[derive(Accounts)]
pub struct WithdrawFromTreasury<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub wsol_mint: Account<'info, Mint>,

    #[account(mut)]
    pub jito_mint: Account<'info, Mint>,

    #[account(mut, token::mint = usdc_mint, token::authority = admin)]
    pub admin_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = wsol_mint, token::authority = admin)]
    pub admin_wsol_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = jito_mint, token::authority = admin)]
    pub admin_jito_ata: Account<'info, TokenAccount>,

    #[account(seeds = [GLOBAL_CONFIG_SEED.as_bytes(), admin.key().as_ref()], bump = global_config.bump, has_one = admin)]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub treasury_vault: Account<'info, TreasuryVault>,

    #[account(
        mut,
        token::mint = usdc_mint,
        token::authority = treasury_vault,
    )]
    pub treasury_vault_usdc_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = wsol_mint,
        token::authority = treasury_vault,
    )]
    pub treasury_vault_wsol_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = jito_mint,
        token::authority = treasury_vault,
    )]
    pub treasury_vault_jito_ata: Account<'info, TokenAccount>,


    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}


impl<'info> WithdrawFromTreasury<'info> {
    pub fn withdraw_from_treasury(&self, mint: Pubkey, amount: u64) -> Result<()> {
        require_keys_eq!(
            self.admin.key(),
            self.global_config.admin,
            NyxWeaveError::UnAuthorizedAdminWithdraw
        );

        let (vault_ata, admin_ata, mint_account) = if mint == self.usdc_mint.key() {
            (&self.treasury_vault_usdc_ata, &self.admin_usdc_ata, &self.usdc_mint)
        } else if mint == self.wsol_mint.key() {
            (&self.treasury_vault_wsol_ata, &self.admin_wsol_ata, &self.wsol_mint)
        } else if mint == self.jito_mint.key() {
            (&self.treasury_vault_jito_ata, &self.admin_jito_ata, &self.jito_mint)
        } else {
            return Err(error!(NyxWeaveError::InvalidMint));
        };

        let signer_seeds: &[&[&[u8]]] = &[&[
            TREASURY_VAULT_SEED.as_bytes(),
            &[self.treasury_vault.bump],
        ]];

        let cpi_accounts = TransferChecked {
            from:      vault_ata.to_account_info(),
            mint:      mint_account.to_account_info(),
            to:        admin_ata.to_account_info(),
            authority: self.treasury_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        transfer_checked(cpi_ctx, amount, mint_account.decimals)
    }
}