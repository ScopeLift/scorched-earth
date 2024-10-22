// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import '@statechannels/nitro-protocol/contracts/interfaces/ForceMoveApp.sol';
import '@statechannels/nitro-protocol/contracts/Outcome.sol';
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract ScorchedEarth is ForceMoveApp {
    using SafeMath for uint256;

    enum Phase {
        Share,
        React
    }

    enum Reaction {
        None, // Not applicable in Share phase
        Pay,
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

    constructor() public { }

    function appData(bytes memory appDataBytes) internal pure returns (SEData memory) {
        return abi.decode(appDataBytes, (SEData));
    }

    function validTransition(
        VariablePart memory _fromPart,
        VariablePart memory _toPart,
        uint256, /* turnNumB */
        uint256  /* nParticipants */
    ) public pure override returns (bool) {
        Outcome.AllocationItem[] memory fromAllocation = extractAllocation(_fromPart);
        Outcome.AllocationItem[] memory toAllocation = extractAllocation(_toPart);

        requireDestinationsUnchanged(fromAllocation, toAllocation);

        // decode ScorchedEarth specific data
        SEData memory fromData = appData(_fromPart.appData);
        SEData memory toData = appData(_toPart.appData);

        requireInternalCoherence(fromData);
        requireInternalCoherence(toData);
        requireCoreParametersUnchanged(fromData, toData);
        requirePhaseToggle(fromData, toData);

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
            'ScorchedEarth: Allocation length must equal number of participants + 1 (i.e. 3)'
        );

        return allocation;
    }

    function requireDestinationsUnchanged(
        Outcome.AllocationItem[] memory _fromAllocation,
        Outcome.AllocationItem[] memory _toAllocation
    ) private pure
    {
        require(
            _toAllocation[0].destination == _fromAllocation[0].destination,
            'ScorchedEarth: Destination participantA may not change'
        );

        require(
            _toAllocation[1].destination == _fromAllocation[1].destination,
            'ScorchedEarth: Destination participantB may not change'
        );

        require(
            _toAllocation[2].destination == _fromAllocation[2].destination,
            'ScorchedEarth: Destination burn beneficiary may not change'
        );
    }

    function requireInternalCoherence(SEData memory _data) private pure {
        if (_data.phase == Phase.Share) {
            require(_data.reaction == Reaction.None,
                    'ScorchedEarth: Reaction not valid for Share phase');
        } else if (_data.phase == Phase.React) {
            require(_data.reaction != Reaction.None,
                    'ScorchedEarth: Reaction not valid for React phase');

            require(bytes(_data.suggestion).length == 0,
                    'ScorchedEarth: Suggestion not valid for React phase');
        } else {
            require(false, 'ScorchedEarth: Invalid phase');
        }
    }

    function requireCoreParametersUnchanged(
        SEData memory _fromData,
        SEData memory _toData
    ) private pure
    {
        require(
            _fromData.payment == _toData.payment &&
            _fromData.suggesterBurn == _toData.suggesterBurn &&
            _fromData.userBurn == _toData.userBurn,
            'ScorchedEarth: Core parameters my not change'
        );
    }

    function requirePhaseToggle(
        SEData memory fromData,
        SEData memory toData
    ) private pure
    {
        require(fromData.phase != toData.phase,
                'ScorchedEarth: Phase must toggle between rounds');
    }
}
