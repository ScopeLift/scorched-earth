import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { expectEvent, expectRevert } from '@openzeppelin/test-helpers';
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
    OutcomeShortHand
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

describe('ScorchedEarth', () => {
    const [ deployer, user, suggester, beneficiary ] = accounts;
    let instance: any;

    let keys: any;

    let adjudicator: any;
    let assetHolder: any;

    let addresses = {
        user: ethers.utils.hexZeroPad(user, 32),
        suggester: ethers.utils.hexZeroPad(suggester, 32),
        beneficiary: ethers.utils.hexZeroPad(beneficiary, 32),
    };

    function createOutcome(balances: {}) {
        const nBalances = replaceAddressesAndBigNumberify(balances, addresses) as AssetOutcomeShortHand;

        const allocation: Allocation = [];
        Object.keys(nBalances).forEach( key => {
            allocation.push({destination: key, amount: nBalances[key] as string});
        });

        const outcome = [{assetHolderAddress: adjudicator.address, allocationItems: allocation}];
        return outcome;
    }

    before(async ()=> {
        instance = await ScorchedEarth.new({from: deployer});
        adjudicator = await NitroAdjudicator.new({from: deployer});
        assetHolder = await EthAssetHolder.new(adjudicator.address, {from: deployer});
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
        const chainId = "0x1234";
        const channelNonce = bigNumberify(0).toHexString();
        const participants = [user, suggester];
        const channel: Channel = { chainId, channelNonce, participants };
        const channelId = getChannelId(channel);

        const startingOutcome = createOutcome({user: 10, suggester: 10, beneficiary: 0});

        const state0: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero, // TODO SEData
            challengeDuration: 1,
            turnNum: 0,
        };

        const state1: State = {
            isFinal: false,
            channel: channel,
            outcome: startingOutcome,
            appDefinition: instance.address,
            appData: ethers.constants.HashZero, // TODO SEData
            challengeDuration: 1,
            turnNum: 1,
        }

        const wallets = [
            new ethers.Wallet("0x" + keys.private_keys[user.toLowerCase()]),
            new ethers.Wallet("0x" + keys.private_keys[suggester.toLocaleLowerCase()]),
        ];

        const whoSignedWhat = [0, 1];
        const sigs = await signStates([state0, state1], wallets, whoSignedWhat);

        const checkpointTx = await adjudicator.checkpoint(
            getFixedPart(state1),
            state1.turnNum,
            [getVariablePart(state0), getVariablePart(state1)],
            0,
            sigs,
            whoSignedWhat,
            {from: user}
        );

        expect(checkpointTx.receipt.status).to.be.true;
    });

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
