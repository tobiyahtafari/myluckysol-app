use anchor_lang::prelude::*;

#[error_code]
pub enum GameError {
    #[msg("Game is already full")]
    GameFull,

    #[msg("Game is not in the correct state for this action")]
    InvalidGameState,

    #[msg("Player is already in this game")]
    PlayerAlreadyJoined,

    #[msg("Player is not in this game")]
    PlayerNotInGame,

    #[msg("Insufficient funds for wager")]
    InsufficientFunds,

    #[msg("Invalid wager amount")]
    InvalidWagerAmount,

    #[msg("Game has not started yet")]
    GameNotStarted,

    #[msg("Game has already ended")]
    GameAlreadyEnded,

    #[msg("Not enough players to start")]
    NotEnoughPlayers,

    #[msg("Round is still in progress")]
    RoundInProgress,

    #[msg("All rounds completed")]
    AllRoundsCompleted,

    #[msg("Only the game authority can perform this action")]
    Unauthorized,

    #[msg("Invalid treasury wallet")]
    InvalidTreasury,

    #[msg("No winner determined yet")]
    NoWinner,

    #[msg("Winnings already claimed")]
    AlreadyClaimed,

    #[msg("Caller is not the winner")]
    NotWinner,

    #[msg("Invalid VRF result")]
    InvalidVrfResult,

    #[msg("Overflow error")]
    Overflow,

    #[msg("House fee has not been paid yet")]
    HouseFeeNotPaid,

    #[msg("VRF account not verified")]
    VrfNotVerified,
}
