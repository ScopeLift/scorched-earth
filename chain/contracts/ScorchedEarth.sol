// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import '@statechannels/nitro-protocol/contracts/interfaces/ForceMoveApp.sol';
import '@statechannels/nitro-protocol/contracts/Outcome.sol';
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract ScorchedEarth is ForceMoveApp {
    using SafeMath for uint256;

    enum Phase {
        Suggest,
        React
    }

    enum Reaction {
        None, // Not applicable in Suggest phase
        Reward,
        Burn
    }

    struct SEData {
        uint256 payment;
        uint256 suggesterBurn;
        uint256 userBurn;
        Phase phase;
        Reaction reaction;
        string suggestion;
    }

    constructor () public { }

    function appData(bytes memory appDataBytes) internal pure returns (SEData memory) {
        return abi.decode(appDataBytes, (SEData));
    }

    function validTransition(
        VariablePart memory _fromPart,
        VariablePart memory _toPart,
        uint48, // turnNumB
        uint256  // nParticipants
    ) public pure override returns (bool) {
        Outcome.AllocationItem[] memory fromAllocation = extractAllocation(_fromPart);
        Outcome.AllocationItem[] memory toAllocation = extractAllocation(_toPart);

        return true;
    }

    function extractAllocation(VariablePart memory _variablePart)
        private
        pure
        returns (Outcome.AllocationItem[] memory)
    {
        Outcome.OutcomeItem[] memory outcome = abi.decode(_variablePart.outcome, (Outcome.OutcomeItem[]));
        require(outcome.length == 1, 'ScorchedEarth: Only one asset allowed');

        Outcome.AssetOutcome memory assetOutcome = abi.decode(
            outcome[0].assetOutcomeBytes,
            (Outcome.AssetOutcome)
        );

        require(
            assetOutcome.assetOutcomeType == uint8(Outcome.AssetOutcomeType.Allocation),
            'ScorchedEarth: AssetOutcomeType must be Allocation'
        );

        Outcome.AllocationItem[] memory allocation = abi.decode(
            assetOutcome.allocationOrGuaranteeBytes,
            (Outcome.AllocationItem[])
        );

        require(
            allocation.length == 3,
            'ScorchedEarth: Allocation length must be 3 (Suggester, Sender, Burner)'
        );

        return allocation;
    }
}
