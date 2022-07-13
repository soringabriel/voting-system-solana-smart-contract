use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[account]
pub struct Poll {
    question: String,
    admin_can_vote: bool,
    active: bool,
    accepted_values: Vec<String>,
    votes: Vec<String>,
    voters: Vec<Pubkey>,
    admin: Pubkey,
}

#[program]
pub mod voting_system {
    use super::*;

    pub fn start_poll(ctx: Context<StartPoll>, question: String, admin_can_vote: bool, active: bool, accepted_values: Vec<String>) -> Result<()> {
        let poll: &mut Account<Poll> = &mut ctx.accounts.poll;

        poll.question = question;
        poll.admin_can_vote = admin_can_vote;
        poll.active = active;
        poll.accepted_values = accepted_values;
        poll.votes = Vec::new();
        poll.voters = Vec::new();
        poll.admin = ctx.accounts.user.key();

        Ok(())
    }

    pub fn open_poll(ctx: Context<TogglePollState>) -> Result<()> {
        let poll: &mut Account<Poll> = &mut ctx.accounts.poll;

        poll.active = true;

        Ok(())
    }

    pub fn close_poll(ctx: Context<TogglePollState>) -> Result<()> {
        let poll: &mut Account<Poll> = &mut ctx.accounts.poll;

        poll.active = false;

        Ok(())
    }

    pub fn vote(ctx: Context<SubmitVote>, value: String, user: Pubkey) -> Result<()> {
        let poll: &mut Account<Poll> = &mut ctx.accounts.poll;

        if !poll.active {
            return err!(Errors::PollIsClosed);
        }

        if !poll.admin_can_vote && poll.admin == user {
            return err!(Errors::AdminCantVote);
        }

        if !poll.accepted_values.iter().any(|v| v == &value) {
            return err!(Errors::WrongValue);
        }

        for el in poll.voters.iter() {
            if el == &user {
                return err!(Errors::AlreadyVoted);
            }
        }

        poll.votes.push(value);
        poll.voters.push(user);
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct StartPoll<'info> {
    #[account(init, payer = user, space = 9000 )]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TogglePollState<'info> {
    #[account(mut)]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitVote<'info> {
    #[account(mut)]
    pub poll: Account<'info, Poll>,
}

#[error_code]
pub enum Errors {
    #[msg("The admin of this poll is not allowed to vote")]
    AdminCantVote,

    #[msg("This poll was closed by its owner")]
    PollIsClosed,

    #[msg("The value given is not correct")]
    WrongValue,

    #[msg("You already voted in this poll")]
    AlreadyVoted,
}