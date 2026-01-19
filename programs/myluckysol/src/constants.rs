use anchor_lang::prelude::*;

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

pub const WAGER_TIER_1: u64 = 10_000_000;
pub const WAGER_TIER_2: u64 = 100_000_000;
pub const WAGER_TIER_3: u64 = 1_000_000_000;
pub const WAGER_TIER_4: u64 = 10_000_000_000;

pub const WINNER_SHARE_BPS: u16 = 9000;
pub const HOUSE_FEE_BPS: u16 = 1000;

pub const WAGA_ENTRY_MULTIPLIER: u64 = 10;
pub const WAGA_WIN_MULTIPLIER: u64 = 100;

pub const MAX_PLAYERS_1V1: u8 = 2;
pub const MAX_PLAYERS_2_ROUND: u8 = 4;
pub const MAX_PLAYERS_3_ROUND: u8 = 8;
pub const MAX_PLAYERS_4_ROUND: u8 = 16;

pub const GAME_TIMER_SECONDS: i64 = 120;
pub const ROUND_TIMER_SECONDS: i64 = 150;
