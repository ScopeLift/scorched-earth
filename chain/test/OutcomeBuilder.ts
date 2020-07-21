import {
    Allocation,
    Outcome,
    AssetOutcomeShortHand,
    replaceAddressesAndBigNumberify,
} from '@statechannels/nitro-protocol';

import { ethers } from 'ethers';

type Address = string;
type AddressMap = {user: Address, suggester: Address, burner: Address};
type Balance = number;
type BalanceMap = {user: Balance, suggester: Balance, burner: Balance};

class OutcomeBuilder {

    paddedAddresses: AddressMap;

    constructor(addresses: AddressMap) {
        this.paddedAddresses = {
            user: ethers.utils.hexZeroPad(addresses.user, 32),
            suggester: ethers.utils.hexZeroPad(addresses.suggester, 32),
            burner: ethers.utils.hexZeroPad(addresses.burner, 32),
        };
    }

    createOutcome(balances: BalanceMap, assetHolder: Address = ethers.constants.AddressZero): Outcome {
        const bigBalances = replaceAddressesAndBigNumberify(balances, this.paddedAddresses) as AssetOutcomeShortHand;

        const allocation: Allocation = [];
        Object.keys(bigBalances).forEach( key => {
            allocation.push({destination: key, amount: bigBalances[key] as string});
        });

        const outcome = [{assetHolderAddress: assetHolder, allocationItems: allocation}];
        return outcome;
    }
}

export default OutcomeBuilder;
