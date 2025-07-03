use anchor_lang::prelude::*;
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
}

/// An Implementation for delegation
impl<'info> DelegateArbitrage<'info> {
    pub fn delegate_strategy(&mut self, token: Pubkey, risk_level: u8) -> Result<()> {

        self.delegate_strategy_vault(
            &self.caller,
            &[b"strategy_vault", token.as_ref(), &risk_level.to_le_bytes()],
            DelegateConfig::default()
        )?;
        Ok(())
    }
}
