use anchor_lang::prelude::*;

#[error_code]
pub enum NyxWeaveError {
    #[msg("Unauthorized admin withdraw")]
    UnAuthorizedAdminWithdraw,

    #[msg("Invalid mint")]
    InvalidMint,

    #[msg("Invalid hedge percentage")]
    InvalidHedgePercentage,
}