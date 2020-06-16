// SPDX-License-Identifier: MIT
pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import '@statechannels/nitro-protocol/contracts/interfaces/ForceMoveApp.sol';
import '@statechannels/nitro-protocol/contracts/Outcome.sol';
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

contract ScorchedEarth is ForceMoveApp {
    using SafeMath for uint256;

    constructor() public { }

    function validTransition(
        VariablePart memory fromPart,
        VariablePart memory toPart,
        uint256, /* turnNumB */
        uint256  /* nParticipants */
    ) public pure override returns (bool) {
        return true;
    }
}
