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

        requireDestinationsUnchanged(fromAllocation, toAllocation);

        // decode ScorchedEarth specific data
        SEData memory fromData = appData(_fromPart.appData);
        SEData memory toData = appData(_toPart.appData);

        requireInternalCoherence(fromData);
        requireInternalCoherence(toData);
        requireCoreParametersUnchanged(fromData, toData);
        requirePhaseToggle(fromData, toData);
        requireProperAllocations(fromAllocation, toAllocation, toData);

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

    function requireDestinationsUnchanged(
        Outcome.AllocationItem[] memory _fromAllocation,
        Outcome.AllocationItem[] memory _toAllocation
    ) private pure
    {
        require(
            _toAllocation[0].destination == _fromAllocation[0].destination,
            'ScorchedEarth: Destination for User may not change'
        );

        require(
            _toAllocation[1].destination == _fromAllocation[1].destination,
            'ScorchedEarth: Destination for Suggester may not change'
        );

        require(
            _toAllocation[2].destination == _fromAllocation[2].destination,
            'ScorchedEarth: Destination for Burner may not change'
        );
    }

    function requireInternalCoherence(SEData memory _data) private pure {
        if (_data.phase == Phase.Suggest) {
            require(_data.reaction == Reaction.None,
                    'ScorchedEarth: Suggest Phase must not have Reaction');

            require(bytes(_data.suggestion).length > 0,
                    'ScorchedEarth: Suggest Phase must have suggestion');
        }
        else if (_data.phase == Phase.React) {
            require(_data.reaction != Reaction.None,
                    'ScorchedEarth: React Phase must have Reaction');

            require(bytes(_data.suggestion).length == 0,
                    'ScorchedEarth: React Phase must not have suggestion');
        } else {
            require(false, 'ScorchedEarth: Invalid Phase');
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
            'ScorchedEarth: Core parameters must not change'
        );
    }

    function requirePhaseToggle(
        SEData memory fromData,
        SEData memory toData
    ) private pure
    {
        require(fromData.phase != toData.phase,
                'ScorchedEarth: Phase must toggle');
    }

    function requireProperAllocations(
        Outcome.AllocationItem[] memory _fromAllocation,
        Outcome.AllocationItem[] memory _toAllocation,
        SEData memory _toData
    ) private pure
    {
        if (_toData.phase == Phase.Suggest) {
            bool didBurnUser = ( _toAllocation[0].amount == (_fromAllocation[0].amount.sub(_toData.payment).sub(_toData.userBurn)) );
            bool didBurnSuggester = ( _toAllocation[1].amount == (_fromAllocation[1].amount.sub(_toData.suggesterBurn)) );
            bool didPayBurner = ( _toAllocation[2].amount == (_fromAllocation[2].amount.add(_toData.payment).add(_toData.userBurn).add(_toData.suggesterBurn)) );

            require(didBurnUser && didBurnSuggester && didPayBurner,
                    'ScorchedEarth: Suggest Phase must burn funds');
        } else if (_toData.phase == Phase.React) {
            if (_toData.reaction == Reaction.Reward) {
                bool didUserPay = ( _toAllocation[0].amount == (_fromAllocation[0].amount.add(_toData.userBurn)) );
                bool didPaySuggester = ( _toAllocation[1].amount == (_fromAllocation[1].amount.add(_toData.suggesterBurn).add(_toData.payment)) );
                bool didUndoBurner = ( _toAllocation[2].amount == (_fromAllocation[2].amount.sub(_toData.payment).sub(_toData.userBurn).sub(_toData.suggesterBurn)) );

                require(didUserPay && didPaySuggester && didUndoBurner,
                        'ScorchedEarth: Reward Reaction must pay');
            } else if (_toData.reaction == Reaction.Burn) {

            } else {
                require(false, 'ScorchedEarth: Invalid reaction');
            }
        } else {
            require(false, 'ScorchedEarth: Invalid Phase');
        }
    }
}
