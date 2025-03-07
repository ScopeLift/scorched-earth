import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { expectRevert } from '@openzeppelin/test-helpers';
import { expect } from 'chai';
import { ethers } from 'ethers';

import {
    Channel,
    State,
    signStates,
    getChannelId,
    getFixedPart,
    getVariablePart,
    Allocation,
    AssetOutcomeShortHand,
    VariablePart,
    replaceAddressesAndBigNumberify,
    encodeOutcome,
    randomExternalDestination,
    ContractArtifacts,
    OutcomeShortHand,
    hashAppPart,
    hashOutcome,
    encodeAllocation
} from '@statechannels/nitro-protocol';

const ScorchedEarth = contract.fromArtifact('ScorchedEarth');

const AddressZero = ethers.constants.AddressZero;
const defaultAbiCoder = ethers.utils.defaultAbiCoder;
const bigNumberify = ethers.BigNumber.from;


const NitroAdjudicator = contract.fromABI(
        ContractArtifacts.NitroAdjudicatorArtifact.abi,
        ContractArtifacts.NitroAdjudicatorArtifact.bytecode
    );

const EthAssetHolder = contract.fromABI(
        ContractArtifacts.EthAssetHolderArtifact.abi,
        ContractArtifacts.EthAssetHolderArtifact.bytecode
    );

enum Phase {
    Share,
    React,
}

enum Reaction {
    None, // Not applicable in Share phase
    Pay,
    Burn
}

interface SEData {
    payment: string; // uint256
    userBurn: string; // uint256
    suggesterBurn: string // uint256
    phase: Phase;
    reaction: Reaction;
    suggestion: string;
}

function encodeSEData(seData: SEData): string {
    return defaultAbiCoder.encode(
        [
            'tuple(uint256 payment, uint256 suggesterBurn, uint256 userBurn, uint8 phase, uint8 reaction, string suggestion)',
        ],
        [seData]
    );
}

function expectBalanceChange(
        initialBalance: string,
        afterBalance: string,
        expectedChange: number
    ) {
        const initialBN = bigNumberify(initialBalance);
        const afterBN = bigNumberify(afterBalance);

        const change = afterBN.sub(initialBN);
        const changeEth = web3.utils.fromWei(change.toString(), 'ether');

        expect(changeEth).to.equal(expectedChange.toString());
}

describe('ScorchedEarth', () => {
    const [ sender, user, suggester, beneficiary ] = accounts;
    let instance: any;

    let keys: any;

    let adjudicator: any;
    let assetHolder: any;

    let addresses = {
        user: ethers.utils.hexZeroPad(user, 32),
        suggester: ethers.utils.hexZeroPad(suggester, 32),
        beneficiary: ethers.utils.hexZeroPad(beneficiary, 32),
    };

    function createOutcome(balances: {user: number, suggester: number, beneficiary: number}) {
        let weiBalances: {} = {
            [ethers.utils.hexZeroPad(user, 32)]: ethers.utils.parseEther(balances.user.toString()),
            [ethers.utils.hexZeroPad(suggester, 32)]: ethers.utils.parseEther(balances.suggester.toString()),
            [ethers.utils.hexZeroPad(beneficiary, 32)]: ethers.utils.parseEther(balances.beneficiary.toString()),
        };

        const allocation: Allocation = [];
        Object.keys(weiBalances).forEach( key => {
            allocation.push({destination: key, amount: weiBalances[key] as string});
        });

        const outcome = [{assetHolderAddress: assetHolder.address, allocationItems: allocation}];
        return outcome;
    }

    before(async ()=> {
        instance = await ScorchedEarth.new({from: sender});
        adjudicator = await NitroAdjudicator.new({from: sender});
        assetHolder = await EthAssetHolder.new(adjudicator.address, {from: sender});
        keys = require('../test-keys.json');
    });

    it('should see the deployed ScorchedEarth, adjudicator, & asset holder contracts', async () => {
        expect(instance.address.startsWith('0x')).to.be.true;
        expect(instance.address.length).to.equal(42);

        expect(adjudicator.address.startsWith('0x')).to.be.true;
        expect(adjudicator.address.length).to.equal(42);

        expect(assetHolder.address.startsWith('0x')).to.be.true;
        expect(assetHolder.address.length).to.equal(42);
    });

    it('should perform an end to end test that transfers assets', async () => {
        const userInitialBalance = await web3.eth.getBalance(user);
        const suggesterInitialBalance = await web3.eth.getBalance(suggester);
        const beneficiaryInitialBalance = await web3.eth.getBalance(beneficiary);

        // CHANNEL METADATA

        const wallets = [
            ethers.Wallet.createRandom(), // suggester ephemeral key
            ethers.Wallet.createRandom(), // user ephermeral key
        ];

        const chainId = "0x1234";
        const channelNonce = bigNumberify(0).toHexString();
        const participants = [wallets[0].address, wallets[1].address];
        const channel: Channel = { chainId, channelNonce, participants };
        const channelId = getChannelId(channel);

        // PRE-FUNDING SETUP STEPS

        const startingOutcome = createOutcome({user: 10, suggester: 10, beneficiary: 0});

        const state0: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero,
            challengeDuration: 1,
            turnNum: 0,
        };

        const state1: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero,
            challengeDuration: 1,
            turnNum: 1,
        }

        const whoSignedWhat = [0, 1];
        const preFundSigs = await signStates([state0, state1], wallets, whoSignedWhat);

        const preFundCheckpointTx = await adjudicator.checkpoint(
            getFixedPart(state1),
            state1.turnNum,
            [getVariablePart(state0), getVariablePart(state1)],
            0,
            preFundSigs,
            whoSignedWhat,
            {from: sender}
        );

        expect(preFundCheckpointTx.receipt.status).to.be.true;

        const depositAmount = ethers.utils.parseEther('10');

        const suggesterDepositTx = await assetHolder.deposit(channelId, 0, depositAmount, {
            from: suggester,
            value: depositAmount.toString(),
            gasPrice: "0",
        });

        const suggesterPostDepositBalance = await web3.eth.getBalance(suggester);

        expect(suggesterDepositTx.receipt.status).to.be.true;
        expectBalanceChange(suggesterInitialBalance, suggesterPostDepositBalance, -10);

        const userDepositTx = await assetHolder.deposit(channelId, depositAmount, depositAmount, {
            from: user,
            value: depositAmount.toString(),
            gasPrice: "0",
        });

        const userPostDepositBalance = await web3.eth.getBalance(user);

        expect(userDepositTx.receipt.status).to.be.true;
        expectBalanceChange(userInitialBalance, userPostDepositBalance, -10)

        // POST-FUNDING SETUP STEPS

        const state2: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero,
            challengeDuration: 1,
            turnNum: 2,
        };

        const state3: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero,
            challengeDuration: 1,
            turnNum: 3,
        }

        const postFundSigs = await signStates([state2, state3], wallets, whoSignedWhat);

        const postFundCheckpointTx = await adjudicator.checkpoint(
            getFixedPart(state3),
            state3.turnNum,
            [getVariablePart(state2), getVariablePart(state3)],
            0,
            postFundSigs,
            whoSignedWhat,
            {from: sender}
        );

        expect(postFundCheckpointTx.receipt.status).to.be.true;

        // SUGGESTER SHARE -> USER PAYS

        const fromAppData: SEData = {
            payment: bigNumberify(2).toString(),
            userBurn: bigNumberify(1).toString(),
            suggesterBurn: bigNumberify(1).toString(),
            phase: Phase.Share,
            reaction: Reaction.None,
            suggestion: 'https://ethereum.org/'
        };

        const fromAppDataBytes = encodeSEData(fromAppData);

        const state4: State = {
            isFinal: false,
            channel: channel,
            outcome: createOutcome({
                user: 9,
                suggester: 9,
                beneficiary: 2,
            }),
            appDefinition: instance.address,
            appData: fromAppDataBytes,
            challengeDuration: 1,
            turnNum: 4,
        }

        const toAppData: SEData = {
            payment: bigNumberify(2).toString(),
            userBurn: bigNumberify(1).toString(),
            suggesterBurn: bigNumberify(1).toString(),
            phase: Phase.React,
            reaction: Reaction.Pay,
            suggestion: ''
        };

        const toAppDataBytes = encodeSEData(toAppData);

        const state5: State = {
            isFinal: false,
            channel: channel,
            outcome: createOutcome({
                user: 8,
                suggester: 12,
                beneficiary: 0,
            }),
            appDefinition: instance.address,
            appData: toAppDataBytes,
            challengeDuration: 1,
            turnNum: 5,
        }

        const postSetupSigs = await signStates([state4, state5], wallets, whoSignedWhat);

        const postSetupCheckpointTx = await adjudicator.checkpoint(
            getFixedPart(state5),
            state5.turnNum,
            [getVariablePart(state4), getVariablePart(state5)],
            0,
            postSetupSigs,
            whoSignedWhat,
            {from: sender}
        );

        expect(postSetupCheckpointTx.receipt.status).to.be.true;

        // SUGGESTER SHARE -> USER BURNS & CLOSES

        const finalFromAppData: SEData = {
            payment: bigNumberify(2).toString(),
            userBurn: bigNumberify(1).toString(),
            suggesterBurn: bigNumberify(1).toString(),
            phase: Phase.Share,
            reaction: Reaction.None,
            suggestion: 'https://ethereum.org/'
        };

        const finalFromAppDataBytes = encodeSEData(finalFromAppData);

        const state6: State = {
            isFinal: false,
            channel: channel,
            outcome: createOutcome({
                user: 7,
                suggester: 11,
                beneficiary: 2,
            }),
            appDefinition: instance.address,
            appData: finalFromAppDataBytes,
            challengeDuration: 1,
            turnNum: 6,
        }

        const finalToAppData: SEData = {
            payment: bigNumberify(2).toString(),
            userBurn: bigNumberify(1).toString(),
            suggesterBurn: bigNumberify(1).toString(),
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: ''
        };

        const finalToAppDataBytes = encodeSEData(finalToAppData);

        const state7: State = {
            isFinal: true,
            channel: channel,
            outcome: createOutcome({
                user: 7,
                suggester: 11,
                beneficiary: 2,
            }),
            appDefinition: instance.address,
            appData: finalToAppDataBytes,
            challengeDuration: 1,
            turnNum: 7,
        }

        const finalSigs = await signStates([state6, state7], wallets, [1, 1]);

        const finalCheckpointTx = await adjudicator.checkpoint(
            getFixedPart(state7),
            state7.turnNum,
            [getVariablePart(state6), getVariablePart(state7)],
            1,
            finalSigs,
            [1, 1],
            {from: sender}
        );

        expect(finalCheckpointTx.receipt.status).to.be.true;

        // CLOSE CHANNEL

        const concludeTx = await adjudicator.conclude(
            7,
            getFixedPart(state7),
            hashAppPart(state7),
            hashOutcome(state7.outcome),
            1,
            [0, 0],
            finalSigs,
            {from: sender},
        );

        expect(concludeTx.receipt.status).to.be.true;

        const concludeBlock = await web3.eth.getBlock(concludeTx.receipt.blockHash);

        const pushOutcomeTx = await adjudicator.pushOutcome(
            channelId,
            0,
            concludeBlock.timestamp,
            ethers.constants.HashZero,
            ethers.constants.AddressZero,
            encodeOutcome(state7.outcome),
            {from: sender},
        );

        expect(pushOutcomeTx.receipt.status).to.be.true;

        const transferAllTx = await assetHolder.transferAll(
            channelId,
            encodeAllocation(state7.outcome[0].allocationItems),
            {from: sender},
        );

        expect(transferAllTx.receipt.status).to.be.true;

        const userEndBalance = await web3.eth.getBalance(user);
        const suggesterEndBalance = await web3.eth.getBalance(suggester);
        const beneficiaryEndBalance = await web3.eth.getBalance(beneficiary);

        expectBalanceChange(userPostDepositBalance, userEndBalance, 7);
        expectBalanceChange(suggesterPostDepositBalance, suggesterEndBalance, 11);
        expectBalanceChange(beneficiaryInitialBalance, beneficiaryEndBalance, 2);
    });

    // TEST TO DEMONSTRATE BASIC ON CHAIN RULE ENCODING W/ FORCE MOVE

    it('should not be valid transition when Phase is unchanged', async () => {
        let fromBalances = replaceAddressesAndBigNumberify({user: 10, suggester: 10, beneficiary: 0}, addresses) as AssetOutcomeShortHand;

        const fromAllocation: Allocation = [];
        Object.keys(fromBalances).forEach( key => {
            fromAllocation.push({destination: key, amount: fromBalances[key] as string});
        });

        const fromOutcome = [{assetHolderAddress: AddressZero, allocationItems: fromAllocation}];

        const fromAppData: SEData = {
            payment: bigNumberify(5).toString(),
            userBurn: bigNumberify(1).toString(),
            suggesterBurn: bigNumberify(1).toString(),
            phase: Phase.Share,
            reaction: Reaction.None,
            suggestion: 'https://ethereum.org/'
        };

        const fromAppDataBytes = encodeSEData(fromAppData);

        const fromVariablePart: VariablePart = {
            outcome: encodeOutcome(fromOutcome),
            appData: fromAppDataBytes,
        };

        const toVariablePart = fromVariablePart;

        await expectRevert(
            instance.validTransition(fromVariablePart, toVariablePart, 1, 2),
            "ScorchedEarth: Phase must toggle between rounds"
        );
    });
});
