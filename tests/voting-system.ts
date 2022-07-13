import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { VotingSystem } from "../target/types/voting_system";
import { expect, assert } from 'chai';

describe("voting-system", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.VotingSystem as Program<VotingSystem>;

    it('start a poll', async () => {
        const pollPair = anchor.web3.Keypair.generate();
        const user = program.provider.wallet;
        await program.rpc.startPoll("Test question?", true, true, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair]
        });

        let poll = await program.account.poll.fetch(pollPair.publicKey);
        expect(poll.question).to.equal("Test question?");
        expect(poll.adminCanVote).to.equal(true);
        expect(poll.active).to.equal(true);
        expect(JSON.stringify(poll.acceptedValues)).to.equal(JSON.stringify(["A", "B", "C", "D"]));
        expect(poll.votes.length).to.equal(0);
        expect(poll.voters.length).to.equal(0);
    });

    it('open poll works correctly', async () => {
        const pollPair = anchor.web3.Keypair.generate();
        const user = program.provider.wallet;
        await program.rpc.startPoll("Test question?", true, false, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair]
        });

        const provider = anchor.AnchorProvider.env();
        const anotherUser = anchor.web3.Keypair.generate();
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(anotherUser.publicKey, 10000000000),
            "confirmed"
        );

        let errored = false;
        try {
            await program.rpc.openPoll({
                accounts: {
                    poll: pollPair.publicKey,
                    user: anotherUser.publicKey,
                },
                signers: []
            })
        } catch (error) {
            errored = true;
        }

        expect(errored).to.equal(true);

        await program.rpc.openPoll({
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
            },
            signers: []
        })

        let poll = await program.account.poll.fetch(pollPair.publicKey);
        expect(poll.active).to.equal(true);
    });

    it('close poll works correctly', async () => {
        const pollPair = anchor.web3.Keypair.generate();
        const user = program.provider.wallet;
        await program.rpc.startPoll("Test question?", true, true, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair]
        });

        const provider = anchor.AnchorProvider.env();
        const anotherUser = anchor.web3.Keypair.generate();
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(anotherUser.publicKey, 10000000000),
            "confirmed"
        );

        let errored = false;
        try {
            await program.rpc.closePoll({
                accounts: {
                    poll: pollPair.publicKey,
                    user: anotherUser.publicKey,
                },
                signers: []
            })
        } catch (error) {
            errored = true;
        }

        expect(errored).to.equal(true);

        await program.rpc.closePoll({
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
            },
            signers: []
        })

        let poll = await program.account.poll.fetch(pollPair.publicKey);
        expect(poll.active).to.equal(false);
    });

    it('poll voting works correctly for owner', async () => {
        const pollPair = anchor.web3.Keypair.generate();
        const user = program.provider.wallet;
        await program.rpc.startPoll("Test question?", true, true, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair]
        });

        await program.rpc.vote('A', user.publicKey, {
            accounts: {
                poll: pollPair.publicKey,
            },
            signers: []
        })

        let errorMessage = "";
        try {
            await program.rpc.vote('A', user.publicKey, {
                accounts: {
                    poll: pollPair.publicKey,
                },
                signers: []
            })
        } catch (error) {
            errorMessage = error.error.errorMessage;
        }
        assert.equal(errorMessage, 'You already voted in this poll');

        const pollPair2 = anchor.web3.Keypair.generate();
        await program.rpc.startPoll("Test question?", false, true, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair2.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair2]
        });

        errorMessage = "";
        try {
            await program.rpc.vote('A', user.publicKey, {
                accounts: {
                    poll: pollPair2.publicKey,
                },
                signers: []
            })
        } catch (error) {
            errorMessage = error.error.errorMessage;
        }
        assert.equal(errorMessage, 'The admin of this poll is not allowed to vote');
    });

    it('poll voting works correctly for other users', async () => {
        const pollPair = anchor.web3.Keypair.generate();
        const user = program.provider.wallet;
        await program.rpc.startPoll("Test question?", true, true, ["A", "B", "C", "D"], {
            accounts: {
                poll: pollPair.publicKey,
                user: user.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            },
            signers: [pollPair]
        });

        const anotherUser = anchor.web3.Keypair.generate();
        await program.rpc.vote('A', anotherUser.publicKey, {
            accounts: {
                poll: pollPair.publicKey,
            },
            signers: []
        })

        let poll = await program.account.poll.fetch(pollPair.publicKey);
        expect(poll.question).to.equal("Test question?");
        expect(poll.adminCanVote).to.equal(true);
        expect(poll.active).to.equal(true);
        expect(JSON.stringify(poll.acceptedValues)).to.equal(JSON.stringify(["A", "B", "C", "D"]));
        expect(poll.votes.length).to.equal(1);
        expect(poll.voters.length).to.equal(1);
    });
});
