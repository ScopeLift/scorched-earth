const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');


const ScorchedEarth = contract.fromArtifact('ScorchedEarth');

describe('ScorchedEarth', () => {
    const [ deployer ] = accounts;

    before(async ()=> {
        this.instance = await ScorchedEarth.new({from: deployer});
    });

    it('should see the deployed ScorchedEarth contract', async () => {
        expect(this.instance.address.startsWith('0x')).to.be.true;
        expect(this.instance.address.length).to.equal(42);
    });
});
