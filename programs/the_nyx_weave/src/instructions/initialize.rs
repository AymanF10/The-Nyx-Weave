//A foundational instruction to set up the protocol's initial state. This would create the GlobalConfig and TreasuryVault PDAs, setting the admin and initial platform parameters.

use anchor_lang::prelude::*;

use crate::{state::{GlobalConfig, TreasuryVault}};


#[derive(Accounts)]
pub struct Initialize<'info> {

    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"global_config", admin.key().as_ref()],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = admin,
        space = 8 + TreasuryVault::INIT_SPACE,
        seeds = [b"treasury_vault", global_config.key().as_ref()],
        bump
    )]
    pub treasury_vault: Account<'info, TreasuryVault>,


    pub system_program: Program<'info, System>,
}


impl<'info> Initialize<'info> {
    pub fn initialize_treasury_and_config(&mut self, global_config_bump: u8, treasury_vault_bump: u8, fee_bps: u16, max_retries: u8) -> Result<()> {

        self.global_config.set_inner(GlobalConfig {
            admin: self.admin.key(),
            fee_bps,
            max_retries,
            bump: global_config_bump,
        });

        self.treasury_vault.set_inner(TreasuryVault {
            admin: self.admin.key(),
            total_profits_secured: 0,
            bump: treasury_vault_bump,
        });
        Ok(())
    }
}