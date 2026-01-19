use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct GameConfig {
    pub authority: Pubkey,
    pub treasury_wallet: Pubkey,
    pub house_fee_bps: u16,
    pub total_games_created: u64,
    pub total_sol_wagered: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Game {
    pub game_id: u64,
    pub authority: Pubkey,
    pub mode: GameMode,
    pub wager_amount: u64,
    pub total_pool: u64,
    pub current_round: u8,
    pub max_rounds: u8,
    pub max_players: u8,
    pub status: GameStatus,
    #[max_len(16)]
    pub players: Vec<Player>,
    #[max_len(16)]
    pub active_players: Vec<Pubkey>,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,
    pub vrf_account: Option<Pubkey>,
    pub house_fee_paid: bool,
    pub winnings_claimed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GamePool {
    pub game_id: u64,
    pub total_deposited: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GameMode {
    OneVsOne,
    TwoRound,
    ThreeRound,
    FourRound,
}

impl GameMode {
    pub fn max_players(&self) -> u8 {
        match self {
            GameMode::OneVsOne => 2,
            GameMode::TwoRound => 4,
            GameMode::ThreeRound => 8,
            GameMode::FourRound => 16,
        }
    }

    pub fn max_rounds(&self) -> u8 {
        match self {
            GameMode::OneVsOne => 1,
            GameMode::TwoRound => 2,
            GameMode::ThreeRound => 3,
            GameMode::FourRound => 4,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum GameStatus {
    WaitingForPlayers,
    InProgress,
    RoundInProgress,
    RoundComplete,
    Completed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Player {
    pub wallet: Pubkey,
    pub joined_at: i64,
    pub is_active: bool,
    pub rounds_survived: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct RoundResult {
    pub round_number: u8,
    pub eliminated_players: Vec<Pubkey>,
    pub vrf_seed: [u8; 32],
    pub timestamp: i64,
}
