import { accounts, contract, web3 } from '@openzeppelin/test-environment';
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ScorchedEarth = contract.fromArtifact('ScorchedEarth');

import { ethers } from 'ethers';
const AddressZero = ethers.constants.AddressZero;
const defaultAbiCoder = ethers.utils.defaultAbiCoder;
const bigNumberify = ethers.BigNumber.from;
import {
    Allocation,
    AssetOutcomeShortHand,
    VariablePart,
    replaceAddressesAndBigNumberify,
    encodeOutcome,
    randomExternalDestination,
    ContractArtifacts
} from '@statechannels/nitro-protocol';

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
    const [ deployer, user, suggester ] = accounts;
    let instance: any;

    let adjudicator: any;
    let assetHolder: any;

    let addresses = {
        user: randomExternalDestination(), // why are addresses from these function padded with leading 0's?
        suggester: randomExternalDestination(),
    }

    before(async ()=> {
        instance = await ScorchedEarth.new({from: deployer});
        adjudicator = await NitroAdjudicator.new({from: deployer});
        assetHolder = await EthAssetHolder.new(adjudicator.address, {from: deployer});
    });

    it('should see the deployed ScorchedEarth, adjudicator, & asset holder contracts', async () => {
        expect(instance.address.startsWith('0x')).to.be.true;
        expect(instance.address.length).to.equal(42);

        expect(adjudicator.address.startsWith('0x')).to.be.true;
        expect(adjudicator.address.length).to.equal(42);

        expect(assetHolder.address.startsWith('0x')).to.be.true;
        expect(assetHolder.address.length).to.equal(42);
    });

    it('should not be valid transition when Phase is unchanged', async () => {
        let fromBalances = replaceAddressesAndBigNumberify({user: 10, suggester: 10}, addresses) as AssetOutcomeShortHand;

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
