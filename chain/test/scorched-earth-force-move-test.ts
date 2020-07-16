import { accounts, contract, web3 } from '@openzeppelin/test-environment';
import { } from '@openzeppelin/test-helpers';
import { expect } from 'chai';

const ScorchedEarth = contract.fromArtifact('ScorchedEarth');

describe('ScorchedEarth Force Move Implementation', () => {
    const [ sender ] = accounts;

    let instance: any;

    before(async ()=> {
        instance = await ScorchedEarth.new({from: sender});
    });

    it('should see the deployed ScorchedEarth, adjudicator, & asset holder contracts', async () => {
        expect(instance.address.startsWith('0x')).to.be.true;
        expect(instance.address.length).to.equal(42);
    });
});
