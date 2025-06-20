use anchor_lang::prelude::*;


/// Administrator account for platform governance
/// Stores the list of admin public keys with privileged access
#[account]
#[derive(InitSpace)]
pub struct Administrator {
    /// List of administrator public keys authorized to perform privileged operations
    /// Limited to a maximum of 3 administrators for security and governance
    #[max_len(3)]
    pub administrators: Vec<Pubkey>,
    
    /// This account's bump seed for PDA verification
    pub administrators_bump: u8,
}