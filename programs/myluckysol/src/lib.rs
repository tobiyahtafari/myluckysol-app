use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};

declare_id!("11111111111111111111111111111111");

pub mod state;
pub mod instructions;
pub mod errors;
pub mod constants;

use state::*;
use errors::*;
use constants::*;

#[program]
pub mod myluckysol {
    use super::*;

    pub fn initialize_game_config(
        ctx: Context<InitializeGameConfig>,
        treasury_wallet: Pubkey,
        house_fee_bps: u16,
    ) -> Result<()> {
        instructions::initialize_game_config(ctx, treasury_wallet, house_fee_bps)
    }

    pub fn create_game(
        ctx: Context<CreateGame>,
        game_id: u64,
        mode: GameMode,
        wager_amount: u64,
    ) -> Result<()> {
        instructions::create_game(ctx, game_id, mode, wager_amount)
    }

    pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
        instructions::join_game(ctx)
    }

    pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
        instructions::start_round(ctx)
    }

    pub fn resolve_round(
        ctx: Context<ResolveRound>,
        vrf_result: [u8; 32],
    ) -> Result<()> {
        instructions::resolve_round(ctx, vrf_result)
    }

    pub fn finalize_game(ctx: Context<FinalizeGame>) -> Result<()> {
        instructions::finalize_game(ctx)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings(ctx)
    }
}

#[derive(Accounts)]
pub struct InitializeGameConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GameConfig::INIT_SPACE,
        seeds = [b"game_config"],
        bump
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct CreateGame<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Game::INIT_SPACE,
        seeds = [b"game", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,

    #[account(
        init,
        payer = creator,
        space = 8 + GamePool::INIT_SPACE,
        seeds = [b"game_pool", game_id.to_le_bytes().as_ref()],
        bump
    )]
    pub game_pool: Account<'info, GamePool>,

    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct JoinGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"game_pool", game.game_id.to_le_bytes().as_ref()],
        bump = game_pool.bump
    )]
    pub game_pool: Account<'info, GamePool>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartRound<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,

    #[account(constraint = authority.key() == game.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveRound<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,

    #[account(constraint = authority.key() == game.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeGame<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"game_pool", game.game_id.to_le_bytes().as_ref()],
        bump = game_pool.bump
    )]
    pub game_pool: Account<'info, GamePool>,

    #[account(seeds = [b"game_config"], bump)]
    pub game_config: Account<'info, GameConfig>,

    #[account(mut, constraint = treasury.key() == game_config.treasury_wallet @ GameError::InvalidTreasury)]
    /// CHECK: Treasury wallet verified against config
    pub treasury: AccountInfo<'info>,

    #[account(constraint = authority.key() == game.authority @ GameError::Unauthorized)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub game: Account<'info, Game>,

    #[account(
        mut,
        seeds = [b"game_pool", game.game_id.to_le_bytes().as_ref()],
        bump = game_pool.bump
    )]
    pub game_pool: Account<'info, GamePool>,

    #[account(mut)]
    pub winner: Signer<'info>,

    pub system_program: Program<'info, System>,
}
