
use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer as SystemTransfer};

use anchor_spl::token::{Token, Mint, TokenAccount, TransferChecked, transfer_checked};


use crate::STRATEGY_VAULT_SEED;
use crate::{ error::NyxWeaveError, state::GlobalConfig, TreasuryVault, TREASURY_VAULT_SEED, GLOBAL_CONFIG_SEED};


#[derive(Accounts)]
pub struct DepositToTreasury<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(mint::token_program = token_program)]
    pub usdc_mint: Account<'info,Mint>,

    #[account(mint::token_program = token_program)]
    pub wsol_mint: Account<'info, Mint>,

    #[account(mint::token_program = token_program)]
    pub jito_mint: Account<'info, Mint>,

    #[account(mut, token::mint = usdc_mint, token::authority = strategy_vault)]
    pub vault_usdc_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = wsol_mint, token::authority = strategy_vault)]
    pub vault_wsol_ata: Account<'info, TokenAccount>,

    #[account(mut, token::mint = jito_mint, token::authority = strategy_vault)]
    pub vault_jito_ata: Account<'info, TokenAccount>,

    //TODO change the PDA seed derivation of the strategy vault
    #[account(seeds = [STRATEGY_VAULT_SEED.as_bytes(), admin.key().as_ref()], bump = global_config.bump)]
    pub strategy_vault: Account<'info, TokenAccount>,

    #[account(seeds = [GLOBAL_CONFIG_SEED.as_bytes(), admin.key().as_ref()], bump = global_config.bump, has_one = admin)]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(seeds = [TREASURY_VAULT_SEED.as_bytes(), global_config.key().as_ref()], bump = treasury_vault.bump)]
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


impl<'info> DepositToTreasury<'info> {

    pub fn lamport_transfer_checked(&self, is_withdraw: bool, amount: u64) -> Result<()> {
        require_keys_eq!(
            self.admin.key(),
            self.global_config.admin,
            NyxWeaveError::UnAuthorizedAdminWithdraw
        );

        let (from_acc, to_acc) = if is_withdraw {
            (
                self.treasury_vault.to_account_info(),
                self.admin.to_account_info(),
            )
        } else {
            (
                self.admin.to_account_info(),
                self.treasury_vault.to_account_info(),
            )
        };

        let transfer_accounts = SystemTransfer {
            from: from_acc.clone(),
            to:   to_acc.clone(),
        };

        if is_withdraw {
            let signer_seeds: &[&[&[u8]]] = &[&[
                TREASURY_VAULT_SEED.as_bytes(),
                &[self.treasury_vault.bump],
            ]];

            let ctx = CpiContext::new_with_signer(
                self.system_program.to_account_info(),
                transfer_accounts,
                signer_seeds,
            );

            system_program::transfer(ctx, amount)
        } else {
            // Deposit: admin is the `from` signer, so no PDA seeds needed
            let ctx = CpiContext::new(
                self.system_program.to_account_info(),
                transfer_accounts,
            );

            system_program::transfer(ctx, amount)
        }
    }

    pub fn token_transfer_checked(&self, is_withdraw: bool, mint: Pubkey, amount: u64) -> Result<()> {

        let (vault_ata, admin_ata, mint_account) = self.select_accounts(mint)?;

        let global_config_key = self.global_config.key();

        let signer_seeds: &[&[&[u8]]] = &[&[
            TREASURY_VAULT_SEED.as_bytes(),
            global_config_key.as_ref(),
            &[self.treasury_vault.bump],
        ]];

        let (from, to) = if is_withdraw {
            (vault_ata, admin_ata)
        } else {
            (admin_ata, vault_ata)
        };

        
        let cpi_accounts = TransferChecked {
            from: from.to_account_info(),
            mint: mint_account.to_account_info(),
            to: to.to_account_info(),
            authority: self.treasury_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        transfer_checked(cpi_ctx, amount, mint_account.decimals)
    }


    pub fn withdraw_token_from_treasury(&self, mint: Pubkey, amount: u64) -> Result<()> {
        self.token_transfer_checked(true, mint, amount)
    }

    pub fn deposit_token_to_treasury(&self, mint: Pubkey, amount: u64) -> Result<()> {
        self.token_transfer_checked(false, mint, amount)
    }

    pub fn withdraw_lamport_from_treasury(&self, amount: u64) -> Result<()> {
        self.lamport_transfer_checked(true, amount)
    }

    pub fn deposit_lamport_to_treasury(&self, amount: u64) -> Result<()> {
        self.lamport_transfer_checked(false, amount)
    }

    pub fn withdraw_all_tokens_from_treasury(&self) -> Result<()> {
        self.withdraw_token_from_treasury(self.usdc_mint.key(), self.treasury_vault_usdc_ata.amount)?;
        self.withdraw_token_from_treasury(self.wsol_mint.key(), self.treasury_vault_wsol_ata.amount)?;
        self.withdraw_lamport_from_treasury(self.treasury_vault.get_lamports())?;
        self.withdraw_token_from_treasury(self.jito_mint.key(), self.treasury_vault_jito_ata.amount)
    }

    fn select_accounts(
        &self,
        mint: Pubkey,
    ) -> Result<(
        &Account<'info, TokenAccount>,
        &Account<'info, TokenAccount>,
        &Account<'info, Mint>,
    )> {
        if mint == self.usdc_mint.key() {
            Ok((&self.treasury_vault_usdc_ata, &self.vault_usdc_ata, &self.usdc_mint))
        } else if mint == self.wsol_mint.key() {
            Ok((&self.treasury_vault_wsol_ata, &self.vault_wsol_ata, &self.wsol_mint))
        } else if mint == self.jito_mint.key() {
            Ok((&self.treasury_vault_jito_ata, &self.vault_jito_ata, &self.jito_mint))
        } else {
            err!(NyxWeaveError::InvalidMint)
        }
    }
} 
