use std::f64::consts::E;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::error::ErrorCode;
use crate::state::*;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub bank: Account<'info, Bank>,
    #[account(
        mut,
        seeds = [b"treasury", mint.key().as_ref()],
        bump,
    )]
    pub bank_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [payer.key().as_ref()],
        bump,
    )]
    pub user: Account<'info, User>,
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = user,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let user = &mut ctx.accounts.user;

    // 使用deposited_value_shares来用户存储资产的份额
    let deposited_value_shares: u64;

    if ctx.accounts.mint.to_account_info().key() == user.usdc_address {
        deposited_value_shares = user.deposited_usdc_shares;
    } else {
        deposited_value_shares = user.deposited_sol_shares;
    }

    let time_diff = user.last_updated - Clock::get()?.unix_timestamp;

    let bank = &mut ctx.accounts.bank;
    //A = P e^(rt) 这里的r和t的单位要一致
    bank.total_depoists =
        (bank.total_depoists as f64 * E.powf(bank.interest_rate as f64 * time_diff as f64)) as u64;

    // 计算每个share的价值
    let value_per_share = bank.total_depoists as f64 / bank.total_deposit_shares as f64;

    let user_value = deposited_value_shares as f64 * value_per_share;

    require!(user_value >= amount as f64, ErrorCode::InsufficientFunds);

    let transfer_cpi_accounts = TransferChecked {
        from: ctx.accounts.bank_token_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.bank_token_account.to_account_info(),
    };

    let mint_key = ctx.accounts.mint.key();
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"treasury",
        mint_key.as_ref(),
        &[ctx.bumps.bank_token_account],
    ]];

    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new_with_signer(cpi_program, transfer_cpi_accounts, signer_seeds);

    transfer_checked(cpi_ctx, amount, ctx.accounts.mint.decimals)?;

    let bank = &mut ctx.accounts.bank;

    let shares_to_remove = (amount as f64 / value_per_share) as u64;

    let user = &mut ctx.accounts.user;

    if ctx.accounts.mint.to_account_info().key() == user.usdc_address {
        user.deposited_usdc -= amount;
        user.deposited_usdc_shares -= shares_to_remove as u64;
    } else {
        user.deposited_sol -= amount;
        user.deposited_sol_shares -= shares_to_remove as u64;
    }

    bank.total_depoists -= amount;
    bank.total_deposit_shares -= shares_to_remove as u64;
    Ok(())
}
