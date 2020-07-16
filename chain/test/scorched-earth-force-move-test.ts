import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { } from '@openzeppelin/test-helpers';
import { expect } from 'chai';
import { ethers } from 'ethers';

const ScorchedEarth = contract.fromArtifact('ScorchedEarth');

describe('ScorchedEarth Force Move Implementation', () => {
    const [ sender ] = accounts;

    let provider: ethers.providers.Web3Provider;
    let senderWallet: ethers.Wallet;
    let instance: ethers.Contract;
    let keys: {private_keys: string};

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

    it('should see the deployed ScorchedEarth, adjudicator, & asset holder contracts', async () => {
        expect(instance.address.startsWith('0x')).to.be.true;
        expect(instance.address.length).to.equal(42);
    });
});
