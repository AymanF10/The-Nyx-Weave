use anchor_lang::prelude::*;
use anchor_spl::associated_token::ID;
use ephemeral_rollups_sdk::{anchor::delegate, cpi::DelegateConfig};




#[delegate]
#[derive(Accounts)]
#[instruction(token: Pubkey, risk_level: u8)]
pub struct DelegateArbitrage<'info> {
    // Accounts for the first swap (buy from lower-priced pool)
    #[account(mut)]
    pub caller: Signer<'info>,

    /// CHECK: Delegating the SV, so safe to use AccountInfo wrapper
    #[account(
        mut,
        del,
        seeds = [b"strategy_vault", token.as_ref(), &risk_level.to_le_bytes()],
        bump,
    )]
    pub strategy_vault: AccountInfo<'info>,

    // I think We Ought To Delegate The strategy vault's ATA as well
    /*  CHECK: This is safe as we are delegating it as well
    #[account(
        mut,
        del,
        seeds = [
            token.as_ref(),
            strategy_vault.key().as_ref(),
            ID.key().as_ref(),
        ],
        bump,
    )]
    pub vault_token_account: AccountInfo<'info>,*/
}

/// An Implementation for delegation
impl<'info> DelegateArbitrage<'info> {
    pub fn delegate_strategy_vault_to_er(&mut self, token: Pubkey, risk_level: u8) -> Result<()> {

        self.delegate_strategy_vault(
            &self.caller,
            &[b"strategy_vault", token.as_ref(), &risk_level.to_le_bytes()],
            DelegateConfig::default()
        )?;

        // GOT TO DELEGATE ATA FOR THE STRATEGY VAULT, AS THAT IS WHAT REALLY CONTAINS THE TOKENS
        /*  NEEDED FOR SWAP INSIDE THE ER
        self.delegate_vault_token_account(
            &self.caller,
            &[self.strategy_vault.key().as_ref(), token.as_ref(), ID.key().as_ref()],
            DelegateConfig::default()
        )?;*/
        Ok(())
    }
}
