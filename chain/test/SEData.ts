import { ethers } from 'ethers';

enum Phase {
    Suggest,
    React,
}

enum Reaction {
    None, // Not applicable in Suggest phase
    Reward,
    Punish,
}

interface SEData {
    payment: string; // uint256
    userBurn: string; // uint256
    suggesterBurn: string // uint256
    phase: Phase;
    reaction: Reaction;
    suggestion: string;
}

function encodeSEData(seData: SEData): string {
    return ethers.utils.defaultAbiCoder.encode(
        [
            'tuple(uint256 payment, uint256 suggesterBurn, uint256 userBurn, uint8 phase, uint8 reaction, string suggestion)',
        ],
        [seData]
    );
}

class SEDataBuilder {

    constants: {
        payment: string,
        userBurn: string,
        suggesterBurn: string
    };

    get parameters() {
        return {
            payment: parseInt(this.constants.payment),
            userBurn: parseInt(this.constants.userBurn),
            suggesterBurn: parseInt(this.constants.suggesterBurn),
        };
    }

    constructor(constants: {
        payment: number,
        userBurn: number,
        suggesterBurn: number})
    {
        this.constants = {
            payment: ethers.BigNumber.from(constants.payment).toString(),
            userBurn: ethers.BigNumber.from(constants.userBurn).toString(),
            suggesterBurn: ethers.BigNumber.from(constants.suggesterBurn).toString(),
        };
    }

    createSEData(params: {
        phase: Phase,
        reaction: Reaction,
        suggestion: string,
    }): SEData
    {
        return {
            ...this.constants,
            ...params,
        };
    }

    createEncodedSEData(params: {
        phase: Phase,
        reaction: Reaction,
        suggestion: string,
    }): string
    {
        const data = this.createSEData(params);
        return encodeSEData(data);
    }
}


export { SEData, Phase, Reaction, encodeSEData, SEDataBuilder };
