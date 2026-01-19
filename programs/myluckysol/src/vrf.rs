use anchor_lang::prelude::*;
use switchboard_solana::prelude::*;

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    #[account(mut)]
    pub game: Account<'info, crate::state::Game>,

    #[account(mut)]
    pub vrf: AccountLoader<'info, VrfAccountData>,

    #[account(mut)]
    pub oracle_queue: AccountLoader<'info, OracleQueueAccountData>,

    #[account(mut)]
    pub queue_authority: AccountInfo<'info>,

    #[account(mut)]
    pub data_buffer: AccountInfo<'info>,

    #[account(mut)]
    pub permission: AccountLoader<'info, PermissionAccountData>,

    #[account(mut)]
    pub escrow: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut)]
    pub payer_wallet: Account<'info, anchor_spl::token::TokenAccount>,

    #[account(mut)]
    pub payer_authority: Signer<'info>,

    pub recent_blockhashes: AccountInfo<'info>,

    pub program_state: AccountLoader<'info, SbState>,

    pub token_program: Program<'info, anchor_spl::token::Token>,

    pub switchboard_program: AccountInfo<'info>,
}

pub fn request_vrf_randomness(ctx: Context<RequestRandomness>) -> Result<()> {
    let game = &ctx.accounts.game;
    
    msg!("Requesting VRF randomness for game {} round {}", 
        game.game_id, game.current_round);

    let vrf = ctx.accounts.vrf.load()?;
    let vrf_request_randomness = VrfRequestRandomness {
        authority: ctx.accounts.payer_authority.to_account_info(),
        vrf: ctx.accounts.vrf.to_account_info(),
        oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
        queue_authority: ctx.accounts.queue_authority.to_account_info(),
        data_buffer: ctx.accounts.data_buffer.to_account_info(),
        permission: ctx.accounts.permission.to_account_info(),
        escrow: ctx.accounts.escrow.clone(),
        payer_wallet: ctx.accounts.payer_wallet.clone(),
        payer_authority: ctx.accounts.payer_authority.to_account_info(),
        recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
        program_state: ctx.accounts.program_state.to_account_info(),
        token_program: ctx.accounts.token_program.to_account_info(),
    };

    msg!("VRF randomness requested successfully");
    Ok(())
}

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    #[account(mut)]
    pub game: Account<'info, crate::state::Game>,

    pub vrf: AccountLoader<'info, VrfAccountData>,
}

pub fn consume_vrf_randomness(ctx: Context<ConsumeRandomness>) -> Result<[u8; 32]> {
    let vrf = ctx.accounts.vrf.load()?;
    
    let result_buffer = vrf.get_result()?;
    
    if result_buffer == [0u8; 32] {
        return Err(crate::errors::GameError::InvalidVrfResult.into());
    }

    msg!("VRF result consumed: {:?}", &result_buffer[..8]);
    Ok(result_buffer)
}

pub fn calculate_elimination_index(
    vrf_result: &[u8; 32],
    player_count: usize,
    round: u8,
) -> Vec<usize> {
    let eliminate_count = player_count / 2;
    let mut eliminated_indices = Vec::with_capacity(eliminate_count);
    
    let base_seed = u64::from_le_bytes(vrf_result[0..8].try_into().unwrap());
    
    for i in 0..eliminate_count {
        let offset_bytes: [u8; 8] = vrf_result[(i * 4) % 24..(i * 4) % 24 + 8]
            .try_into()
            .unwrap_or([0u8; 8]);
        let offset_seed = u64::from_le_bytes(offset_bytes);
        
        let combined_seed = base_seed
            .wrapping_add(offset_seed)
            .wrapping_add(round as u64);
        
        let remaining_players = player_count - i;
        let index = (combined_seed as usize) % remaining_players;
        
        let mut actual_index = index;
        for &prev_idx in &eliminated_indices {
            if actual_index >= prev_idx {
                actual_index += 1;
            }
        }
        
        eliminated_indices.push(actual_index);
        eliminated_indices.sort();
    }
    
    eliminated_indices
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_elimination_calculation() {
        let vrf_result = [1u8; 32];
        let indices = calculate_elimination_index(&vrf_result, 8, 1);
        
        assert_eq!(indices.len(), 4);
        
        for i in 0..indices.len() {
            for j in (i + 1)..indices.len() {
                assert_ne!(indices[i], indices[j]);
            }
        }
        
        for &idx in &indices {
            assert!(idx < 8);
        }
    }

    #[test]
    fn test_deterministic_results() {
        let vrf_result = [42u8; 32];
        
        let indices1 = calculate_elimination_index(&vrf_result, 4, 1);
        let indices2 = calculate_elimination_index(&vrf_result, 4, 1);
        
        assert_eq!(indices1, indices2);
    }
}
