use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::*;
use crate::errors::*;
use crate::constants::*;
use crate::{InitializeGameConfig, CreateGame, JoinGame, StartRound, ResolveRound, FinalizeGame, ClaimWinnings};

pub fn initialize_game_config(
    ctx: Context<InitializeGameConfig>,
    treasury_wallet: Pubkey,
    house_fee_bps: u16,
) -> Result<()> {
    let game_config = &mut ctx.accounts.game_config;
    game_config.authority = ctx.accounts.authority.key();
    game_config.treasury_wallet = treasury_wallet;
    game_config.house_fee_bps = house_fee_bps;
    game_config.total_games_created = 0;
    game_config.total_sol_wagered = 0;
    game_config.bump = ctx.bumps.game_config;
    
    msg!("Game config initialized with treasury: {}", treasury_wallet);
    Ok(())
}

pub fn create_game(
    ctx: Context<CreateGame>,
    game_id: u64,
    mode: GameMode,
    wager_amount: u64,
) -> Result<()> {
    require!(
        wager_amount == WAGER_TIER_1 ||
        wager_amount == WAGER_TIER_2 ||
        wager_amount == WAGER_TIER_3 ||
        wager_amount == WAGER_TIER_4,
        GameError::InvalidWagerAmount
    );

    let game = &mut ctx.accounts.game;
    let game_pool = &mut ctx.accounts.game_pool;
    let clock = Clock::get()?;

    game.game_id = game_id;
    game.authority = ctx.accounts.creator.key();
    game.mode = mode;
    game.wager_amount = wager_amount;
    game.total_pool = 0;
    game.current_round = 0;
    game.max_rounds = mode.max_rounds();
    game.max_players = mode.max_players();
    game.status = GameStatus::WaitingForPlayers;
    game.players = Vec::new();
    game.active_players = Vec::new();
    game.winner = None;
    game.created_at = clock.unix_timestamp;
    game.started_at = None;
    game.ended_at = None;
    game.vrf_account = None;
    game.house_fee_paid = false;
    game.winnings_claimed = false;
    game.bump = ctx.bumps.game;

    game_pool.game_id = game_id;
    game_pool.total_deposited = 0;
    game_pool.bump = ctx.bumps.game_pool;

    msg!("Game {} created with mode {:?} and wager {} lamports", game_id, mode, wager_amount);
    Ok(())
}

pub fn join_game(ctx: Context<JoinGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_pool = &mut ctx.accounts.game_pool;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;

    require!(
        game.status == GameStatus::WaitingForPlayers,
        GameError::InvalidGameState
    );

    require!(
        (game.players.len() as u8) < game.max_players,
        GameError::GameFull
    );

    require!(
        !game.players.iter().any(|p| p.wallet == player.key()),
        GameError::PlayerAlreadyJoined
    );

    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: player.to_account_info(),
            to: game_pool.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, game.wager_amount)?;

    game.players.push(Player {
        wallet: player.key(),
        joined_at: clock.unix_timestamp,
        is_active: true,
        rounds_survived: 0,
    });
    game.active_players.push(player.key());
    game.total_pool = game.total_pool
        .checked_add(game.wager_amount)
        .ok_or(GameError::Overflow)?;
    game_pool.total_deposited = game_pool.total_deposited
        .checked_add(game.wager_amount)
        .ok_or(GameError::Overflow)?;

    msg!("Player {} joined game {}. Total players: {}", 
        player.key(), game.game_id, game.players.len());

    if game.players.len() as u8 == game.max_players {
        game.status = GameStatus::InProgress;
        game.started_at = Some(clock.unix_timestamp);
        msg!("Game {} is now full and starting!", game.game_id);
    }

    Ok(())
}

pub fn start_round(ctx: Context<StartRound>) -> Result<()> {
    let game = &mut ctx.accounts.game;

    require!(
        game.status == GameStatus::InProgress || game.status == GameStatus::RoundComplete,
        GameError::InvalidGameState
    );

    require!(
        game.current_round < game.max_rounds,
        GameError::AllRoundsCompleted
    );

    game.current_round = game.current_round.checked_add(1).ok_or(GameError::Overflow)?;
    game.status = GameStatus::RoundInProgress;

    msg!("Round {} started for game {}", game.current_round, game.game_id);
    Ok(())
}

pub fn resolve_round(
    ctx: Context<ResolveRound>,
    vrf_result: [u8; 32],
) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let clock = Clock::get()?;

    require!(
        game.status == GameStatus::RoundInProgress,
        GameError::InvalidGameState
    );

    require!(
        vrf_result != [0u8; 32],
        GameError::InvalidVrfResult
    );

    let active_count = game.active_players.len();
    require!(active_count > 1, GameError::InvalidGameState);

    let eliminate_count = active_count / 2;
    
    let seed = u64::from_le_bytes(vrf_result[0..8].try_into().unwrap());
    
    let mut indices_to_eliminate: Vec<usize> = Vec::new();
    for i in 0..eliminate_count {
        let offset = ((seed.wrapping_add(i as u64)) as usize) % (active_count - i);
        let mut actual_index = offset;
        for &eliminated in &indices_to_eliminate {
            if actual_index >= eliminated {
                actual_index += 1;
            }
        }
        indices_to_eliminate.push(actual_index);
        indices_to_eliminate.sort();
    }

    let current_round = game.current_round;
    for (offset, &idx) in indices_to_eliminate.iter().enumerate() {
        let actual_idx = idx - offset;
        let eliminated_wallet = game.active_players.remove(actual_idx);
        
        for player in game.players.iter_mut() {
            if player.wallet == eliminated_wallet {
                player.is_active = false;
                player.rounds_survived = current_round;
                break;
            }
        }
        msg!("Player {} eliminated in round {}", eliminated_wallet, current_round);
    }

    if game.active_players.len() == 1 {
        game.winner = Some(game.active_players[0]);
        game.status = GameStatus::Completed;
        game.ended_at = Some(clock.unix_timestamp);
        msg!("Game {} completed! Winner: {}", game.game_id, game.winner.unwrap());
    } else if game.current_round >= game.max_rounds {
        game.status = GameStatus::Completed;
        game.ended_at = Some(clock.unix_timestamp);
    } else {
        game.status = GameStatus::RoundComplete;
    }

    Ok(())
}

pub fn finalize_game(ctx: Context<FinalizeGame>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_pool = &ctx.accounts.game_pool;
    let game_config = &ctx.accounts.game_config;

    require!(
        game.status == GameStatus::Completed,
        GameError::InvalidGameState
    );

    require!(
        game.winner.is_some(),
        GameError::NoWinner
    );

    require!(
        !game.house_fee_paid,
        GameError::AlreadyClaimed
    );

    let total_pool = game_pool.total_deposited;
    let house_fee = (total_pool as u128)
        .checked_mul(game_config.house_fee_bps as u128)
        .ok_or(GameError::Overflow)?
        .checked_div(10000)
        .ok_or(GameError::Overflow)? as u64;

    let game_pool_info = game_pool.to_account_info();
    let treasury_info = ctx.accounts.treasury.to_account_info();

    **game_pool_info.try_borrow_mut_lamports()? -= house_fee;
    **treasury_info.try_borrow_mut_lamports()? += house_fee;

    game.house_fee_paid = true;

    msg!("House fee of {} lamports sent to treasury", house_fee);
    Ok(())
}

pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
    let game = &mut ctx.accounts.game;
    let game_pool = &ctx.accounts.game_pool;
    let winner = &ctx.accounts.winner;

    require!(
        game.status == GameStatus::Completed,
        GameError::InvalidGameState
    );

    require!(
        game.winner == Some(winner.key()),
        GameError::NotWinner
    );

    require!(
        game.house_fee_paid,
        GameError::HouseFeeNotPaid
    );

    require!(
        !game.winnings_claimed,
        GameError::AlreadyClaimed
    );

    let winnings = game_pool.to_account_info().lamports();
    
    let game_pool_info = game_pool.to_account_info();
    let winner_info = winner.to_account_info();

    **game_pool_info.try_borrow_mut_lamports()? = 0;
    **winner_info.try_borrow_mut_lamports()? += winnings;

    game.winnings_claimed = true;

    msg!("Winner {} claimed {} lamports", winner.key(), winnings);
    Ok(())
}
