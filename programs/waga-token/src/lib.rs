use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("9NWksMKpEd9brW31BU6eZKvbUykRuCZgtbYBpcT6oeho");

#[program]
pub mod waga_token {
    use super::*;

    pub fn initialize_token(
        ctx: Context<InitializeToken>,
        decimals: u8,
    ) -> Result<()> {
        let token_config = &mut ctx.accounts.token_config;
        token_config.authority = ctx.accounts.authority.key();
        token_config.mint = ctx.accounts.mint.key();
        token_config.total_minted = 0;
        token_config.bump = ctx.bumps.token_config;
        
        msg!("WAGA token initialized with mint: {}", ctx.accounts.mint.key());
        Ok(())
    }

    pub fn mint_reward(
        ctx: Context<MintReward>,
        amount: u64,
    ) -> Result<()> {
        let token_config = &mut ctx.accounts.token_config;
        
        let seeds = &[
            b"waga_mint_authority".as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token::mint_to(cpi_ctx, amount)?;
        
        token_config.total_minted = token_config.total_minted
            .checked_add(amount)
            .ok_or(WagaError::Overflow)?;
        
        msg!("Minted {} WAGA tokens to {}", amount, ctx.accounts.recipient.key());
        Ok(())
    }

    pub fn mint_entry_reward(
        ctx: Context<MintReward>,
        wager_amount: u64,
    ) -> Result<()> {
        let reward_amount = wager_amount
            .checked_mul(WAGA_ENTRY_MULTIPLIER)
            .ok_or(WagaError::Overflow)?;
        
        let token_config = &mut ctx.accounts.token_config;
        
        let seeds = &[
            b"waga_mint_authority".as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token::mint_to(cpi_ctx, reward_amount)?;
        
        token_config.total_minted = token_config.total_minted
            .checked_add(reward_amount)
            .ok_or(WagaError::Overflow)?;
        
        msg!("Minted {} WAGA entry reward to {}", reward_amount, ctx.accounts.recipient.key());
        Ok(())
    }

    pub fn mint_win_bonus(
        ctx: Context<MintReward>,
        winnings_amount: u64,
    ) -> Result<()> {
        let bonus_amount = winnings_amount
            .checked_mul(WAGA_WIN_MULTIPLIER)
            .ok_or(WagaError::Overflow)?;
        
        let token_config = &mut ctx.accounts.token_config;
        
        let seeds = &[
            b"waga_mint_authority".as_ref(),
            &[ctx.bumps.mint_authority],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        
        token::mint_to(cpi_ctx, bonus_amount)?;
        
        token_config.total_minted = token_config.total_minted
            .checked_add(bonus_amount)
            .ok_or(WagaError::Overflow)?;
        
        msg!("Minted {} WAGA win bonus to {}", bonus_amount, ctx.accounts.recipient.key());
        Ok(())
    }
}

pub const WAGA_ENTRY_MULTIPLIER: u64 = 10;
pub const WAGA_WIN_MULTIPLIER: u64 = 100;

#[account]
#[derive(InitSpace)]
pub struct TokenConfig {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_minted: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitializeToken<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + TokenConfig::INIT_SPACE,
        seeds = [b"waga_config"],
        bump
    )]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = mint_authority,
        seeds = [b"waga_mint"],
        bump
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA for mint authority
    #[account(
        seeds = [b"waga_mint_authority"],
        bump
    )]
    pub mint_authority: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintReward<'info> {
    #[account(mut, seeds = [b"waga_config"], bump = token_config.bump)]
    pub token_config: Account<'info, TokenConfig>,

    #[account(
        mut,
        seeds = [b"waga_mint"],
        bump
    )]
    pub mint: Account<'info, Mint>,

    /// CHECK: PDA for mint authority
    #[account(
        seeds = [b"waga_mint_authority"],
        bump
    )]
    pub mint_authority: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// CHECK: Recipient of the tokens
    pub recipient: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(constraint = game_authority.key() == token_config.authority @ WagaError::Unauthorized)]
    pub game_authority: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[error_code]
pub enum WagaError {
    #[msg("Overflow error")]
    Overflow,
    #[msg("Unauthorized")]
    Unauthorized,
}
