import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { expectRevert } from '@openzeppelin/test-helpers';
import { expect } from 'chai';
import { ethers } from 'ethers';

import {
    Allocation,
    Outcome,
    encodeOutcome,
    VariablePart,
} from '@statechannels/nitro-protocol';

import OutcomeBuilder from './OutcomeBuilder';
import { Phase, Reaction, SEDataBuilder } from './SEData';

const ScorchedEarth = contract.fromArtifact('ScorchedEarth');
const suggestion = 'https://ethereum.org/static/22580a5e7d69e200d6b2d2131904fbdf/32411/doge_computer.png';

describe('ScorchedEarth Force Move Implementation', () => {
    const [ sender, user, suggester, burner ] = accounts;

    let provider: ethers.providers.Web3Provider;
    let senderWallet: ethers.Wallet;
    let instance: ethers.Contract;
    let keys: {private_keys: string};
    let outcomeBuilder = new OutcomeBuilder({user, suggester, burner,});
    let dataBuilder = new SEDataBuilder({payment: 5, userBurn: 2, suggesterBurn: 2});

    before(async () => {
        // Test the provider and make sure ganache is running before loading keys
        provider = new ethers.providers.Web3Provider(web3.currentProvider as ethers.providers.ExternalProvider);
        const block = await provider.getBlockNumber();
        expect(block).to.equal(0);

        // Load private keys of ganache accounts
        keys = require('../test-keys.json');

        // Create wallet for the first ganache account
        const senderKey = keys.private_keys[sender.toLowerCase()];
        senderWallet = new ethers.Wallet(`0x${senderKey}`).connect(provider);
        expect(senderWallet.address).to.equal(sender);

        // Deploy ScorchedEarth
        const factory = new ethers.ContractFactory(ScorchedEarth.abi, ScorchedEarth.bytecode, senderWallet);
        instance = await factory.deploy();
    });

    it('should see the deployed ScorchedEarth contract', async () => {
        expect(instance.address.startsWith('0x')).to.be.true;
        expect(instance.address.length).to.equal(42);
    });

    it('should not allow an outcome with more than one asset allocation', async () => {
        const fromOutcome: Outcome = [
            {assetHolderAddress: ethers.constants.AddressZero, allocationItems: []},
            {assetHolderAddress: ethers.constants.AddressZero, allocationItems: []}, // second asset allocation
        ];

        const toOutcome: Outcome = [
            {assetHolderAddress: ethers.constants.AddressZero, allocationItems: []},
        ];

        const appData = ethers.utils.defaultAbiCoder.encode([], []);

        const fromVariablePart: VariablePart = {
            outcome: encodeOutcome(fromOutcome),
            appData: appData,
        };

        const toVariablePart: VariablePart = {
            outcome: encodeOutcome(toOutcome),
            appData: appData,
        };

        let validationTx = instance.validTransition(fromVariablePart, toVariablePart, 4, 2);

        await expectRevert(
            validationTx,
            "ScorchedEarth: Only one asset allowed",
        );
    });

    it('should not allow an outcome with 0 allocations', async () => {
        const fromOutcome: Outcome = [
            {assetHolderAddress: ethers.constants.AddressZero, allocationItems: []},
        ];


        const toOutcome: Outcome = [
            {assetHolderAddress: ethers.constants.AddressZero, allocationItems: []},
        ];

        const appData = ethers.utils.defaultAbiCoder.encode([], []);

        const fromVariablePart: VariablePart = {
            outcome: encodeOutcome(fromOutcome),
            appData: appData,
        };

        const toVariablePart: VariablePart = {
            outcome: encodeOutcome(toOutcome),
            appData: appData,
        };

        let validationTx = instance.validTransition(fromVariablePart, toVariablePart, 4, 2);

        await expectRevert(
            validationTx,
            "ScorchedEarth: Allocation length must be 3 (Suggester, Sender, Burner)",
        );
    });

    it('should not allow transitions where destinations change', async () => {
        const balances = {user: 100, suggester: 100, burner: 0};
        const appData = ethers.utils.defaultAbiCoder.encode([], []);

        const fromOutcome = outcomeBuilder.createEncodedOutcome(balances);

        // Switch User and Suggester
        const switchedBuilder = new OutcomeBuilder({user: suggester, suggester: user, burner: burner});
        const switchedOutcome = switchedBuilder.createEncodedOutcome(balances);

        let switchedTx = instance.validTransition(
                {outcome: fromOutcome, appData},
                {outcome: switchedOutcome, appData},
                4,
                2
            );

        await expectRevert(
            switchedTx,
            "ScorchedEarth: Destination for User may not change",
        );

        // Totally change the Burner
        const changedBuilder = new OutcomeBuilder({user, suggester, burner: sender});
        const changedOutcome = changedBuilder.createEncodedOutcome(balances);

        let changedTx = instance.validTransition(
                {outcome: fromOutcome, appData},
                {outcome: changedOutcome, appData},
                4,
                2,
            );

        await expectRevert(
            changedTx,
            "ScorchedEarth: Destination for Burner may not change",
        );
    });

    it('should not accept a share phase that has a reaction', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.Reward,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome, appData: fromData},
            {outcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Suggest Phase must not have Reaction",
        );
    });

    it('should not accept a react phase that has no reaction', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.None,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome, appData: fromData},
            {outcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: React Phase must have Reaction",
        );
    });

    it('should not accept a suggest phase that has no suggestion', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome, appData: fromData},
            {outcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Suggest Phase must have suggestion",
        );
    });

    it('should not accept a react phase that has a suggestion', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: suggestion,
        });

        let validationTx = instance.validTransition(
            {outcome, appData: fromData},
            {outcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: React Phase must not have suggestion",
        );
    });
});
