use anchor_lang::prelude::*;

use anchor_spl::{associated_token::AssociatedToken, token_interface::TokenAccount};
use ephemeral_rollups_sdk::anchor::commit;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};

use crate::state::*;
use crate::error;


#[commit]
#[derive(Accounts)]
pub struct ArbitrageCommit<'info> {

    #[account(mut)]
    pub caller: Signer<'info>,

    /// The administrator account containing authorized admins
    /// Used to verify the signer has admin privileges
    #[account(
        mut,
        seeds = [b"administrators"],
        bump = admins.administrators_bump,
    )]
    pub admins: Account<'info, Administrator>,

    #[account(
        mut,
        seeds = [b"strategy_vault", strategy_vault.deposit_token_mint.as_ref(),
        &strategy_vault.risk_level.to_le_bytes()],
        bump,
    )]
    pub strategy_vault: Account<'info, StrategyVault>,

    #[account(
        mut,
        associated_token::mint = strategy_vault.deposit_token_mint,
        associated_token::authority = strategy_vault.key()
    )]
    pub vault_token_account: InterfaceAccount<'info, TokenAccount>,

    pub associated_token_program: Program<'info, AssociatedToken>
}


impl<'info> ArbitrageCommit<'info> {

    pub fn commit_arbitrage_without_undelegating(&mut self) -> Result<()> {

        // Put Arbitrage Logic Execution Here, 
        commit_accounts(
            &self.caller,
            vec![
                &self.strategy_vault.to_account_info(),
                &self.vault_token_account.to_account_info()
            ],
            &self.magic_context,
            &self.magic_program
        )?;
        Ok(())
    }


    // COMMIT ARBITRAGE AND UNDELEGATE
    pub fn commit_arbitrage_plus_undelegate(&mut self) -> Result<()> {

        // Commit And Undelegate from ER should be Privileged and Not Permissionless
        require!(&self.admins.administrators.contains(&self.caller.key()), crate::error::ErrorCode::OnlyAdmin);

        // Call Arbitrage Execution Here OR We Can Do That Via Client-Side(Researching If Possible)

        // todo!() Update The Strategy Vault Account Before Undelegating. Done below
        // We are undelegating, so we need to set the is_delegated flag to false to signify undelegation state
        self.strategy_vault.is_delegated = false;

        // Commit and Undelegate the Accounts
        commit_and_undelegate_accounts(
            &self.caller,
            vec![
                &self.strategy_vault.to_account_info(),
                &self.vault_token_account.to_account_info()
            ],
            &self.magic_context,
            &self.magic_program
        )?;
        Ok(())
    }
}