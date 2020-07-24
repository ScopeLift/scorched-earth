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

    it('should not allow payment parameter to change between turns', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});
        const badDataBuilder = new SEDataBuilder({payment: 4, userBurn: 2, suggesterBurn: 2});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = badDataBuilder.createEncodedSEData({
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
            "ScorchedEarth: Core parameters must not change",
        );
    });

    it('should not allow userBurn parameter to change between turns', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});
        const badDataBuilder = new SEDataBuilder({payment: 5, userBurn: 3, suggesterBurn: 2});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = badDataBuilder.createEncodedSEData({
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
            "ScorchedEarth: Core parameters must not change",
        );
    });

    it('should not allow suggesterBurn parameter to change between turns', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});
        const badDataBuilder = new SEDataBuilder({payment: 5, userBurn: 2, suggesterBurn:1});

        const fromData = badDataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
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
            "ScorchedEarth: Core parameters must not change",
        );
    });

    it('should not accept two suggest phases in a row', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
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
            "ScorchedEarth: Phase must toggle",
        );
    });

    it('should not accept two react phases in a row', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
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
            "ScorchedEarth: Phase must toggle",
        );
    });

    it('should not accept if the suggest phase does not assume fund burn', async () => {
        const outcome = outcomeBuilder.createEncodedOutcome({user: 100, suggester: 100, burner: 0});

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
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
            "ScorchedEarth: Suggest Phase must burn funds",
        );
    });

    it('should not accept if the suggest phase does not pay the burner', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome(initialAllocations);
        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner, // WRONG
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Suggest Phase must burn funds",
        );
    });

    it('should not accept if the suggest phase does not burn the suggester', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome(initialAllocations);
        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester, // WRONG
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Suggest Phase must burn funds",
        );
    });

    it('should not accept if the suggest phase does not burn the user', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome(initialAllocations);
        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user, // WRONG
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Suggest Phase must burn funds",
        );
    });

    it('should validate a suggest phase that correctly assumes fund burn', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome(initialAllocations);
        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        let isValid = await instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        expect(isValid).to.be.true;
    });

    it('should not accept a react phase that does not pay the suggester', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment,
            suggester: initialAllocations.suggester, // WRONG
            burner: initialAllocations.burner,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Reward Reaction must pay",
        );
    });

    it('should not accept a react phase that does not spend user funds', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user, // WRONG
            suggester: initialAllocations.suggester + parameters.payment,
            burner: initialAllocations.burner,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Reward Reaction must pay",
        );
    });

    it('should not accept a react phase that sends the burner funds', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment,
            suggester: initialAllocations.suggester + parameters.payment,
            burner: initialAllocations.burner + 1, // WRONG
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Reward Reaction must pay",
        );
    });

    it('should validate a react phase that correctly rewards the suggester', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment,
            suggester: initialAllocations.suggester + parameters.payment,
            burner: initialAllocations.burner,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Reward,
            suggestion: '',
        });

        let isValid = await instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        expect(isValid).to.be.true;
    });

    it('should not accept a react phase that does not burn user funds', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment, // WRONG
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Punish Reaction must burn",
        );
    });

    it('should not accept a react phase that does not burn suggester funds', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester, // WRONG
            burner: initialAllocations.burner + parameters.payment + parameters.userBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Punish Reaction must burn",
        );
    });

    it('should not accept a react phase that does send burner funds', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner, // WRONG
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let validationTx = instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        await expectRevert(
            validationTx,
            "ScorchedEarth: Punish Reaction must burn",
        );
    });


    it('should validate a react phase that correctly punishes the suggester', async () => {
        const initialAllocations = {user: 100, suggester: 100, burner: 0};
        const parameters = dataBuilder.parameters;

        const fromOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const toOutcome = outcomeBuilder.createEncodedOutcome({
            user: initialAllocations.user - parameters.payment - parameters.userBurn,
            suggester: initialAllocations.suggester - parameters.suggesterBurn,
            burner: initialAllocations.burner + parameters.payment + parameters.suggesterBurn + parameters.userBurn,
        });

        const fromData = dataBuilder.createEncodedSEData({
            phase: Phase.Suggest,
            reaction: Reaction.None,
            suggestion: suggestion,
        });

        const toData = dataBuilder.createEncodedSEData({
            phase: Phase.React,
            reaction: Reaction.Burn,
            suggestion: '',
        });

        let isValid = await instance.validTransition(
            {outcome: fromOutcome, appData: fromData},
            {outcome: toOutcome, appData: toData},
            4,
            2,
        );

        expect(isValid).to.be.true;
    });
});
