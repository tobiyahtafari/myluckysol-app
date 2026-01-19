use anchor_lang::prelude::*;
use switchboard_solana::prelude::*;
use crate::state::{Game, GameStatus};
use crate::errors::GameError;

#[derive(Accounts)]
pub struct SetupVrf<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::InProgress @ GameError::InvalidGameState,
        constraint = game.authority == authority.key() @ GameError::Unauthorized
    )]
    pub game: Account<'info, Game>,

    pub vrf: AccountLoader<'info, VrfAccountData>,

    #[account(constraint = authority.key() == game.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,
}

pub fn setup_vrf_account(ctx: Context<SetupVrf>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let vrf = &ctx.accounts.vrf;
    
    game.vrf_account = Some(vrf.key());
    
    msg!("VRF account {} linked to game {}", vrf.key(), game.game_id);
    Ok(())
}

#[derive(Accounts)]
pub struct ResolveRoundWithVrf<'info> {
    #[account(
        mut,
        constraint = game.status == GameStatus::RoundInProgress @ GameError::InvalidGameState,
        constraint = game.vrf_account == Some(vrf.key()) @ GameError::VrfNotVerified
    )]
    pub game: Account<'info, Game>,

    #[account(
        constraint = {
            let vrf_data = vrf.load()?;
            vrf_data.get_result().map(|r| r != [0u8; 32]).unwrap_or(false)
        } @ GameError::InvalidVrfResult
    )]
    pub vrf: AccountLoader<'info, VrfAccountData>,

    #[account(constraint = authority.key() == game.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,
}

pub fn resolve_round_with_verified_vrf(ctx: Context<ResolveRoundWithVrf>) -> Result<[u8; 32]> {
    let vrf = ctx.accounts.vrf.load()?;
    
    let result_buffer = vrf.get_result()?;
    
    require!(
        result_buffer != [0u8; 32],
        GameError::InvalidVrfResult
    );

    msg!("Verified VRF result for game {}: {:?}", 
        ctx.accounts.game.game_id, 
        &result_buffer[..8]);
    
    Ok(result_buffer)
}

pub fn verify_vrf_result(vrf_account: &AccountLoader<VrfAccountData>) -> Result<[u8; 32]> {
    let vrf = vrf_account.load()?;
    let result = vrf.get_result()?;
    
    require!(
        result != [0u8; 32],
        GameError::InvalidVrfResult
    );
    
    Ok(result)
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
