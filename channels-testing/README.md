# Scorched Earth "State Channels" Proof-of-Viability

This directory house proof-of-concept level code, the purpose of which is to validate the viability of the [State Channels](https://statechannels.org/) developer toolkit to meet the needs of the Scorched Earth project.

## Components

### Contract

The contract in `ScorchedEarth.sol` demonstrates a simple implementation of the ForceMoveApp protocol, which will enable us to encode the basic rules of the Scorched Earth application into the contract which exists on-chain. The rules are encoded in the [`validTransition`](https://github.com/ScopeLift/scorched-earth/blob/master/channels-testing/contracts/ScorchedEarth.sol#L38)` function.

This contract implementation serves as the [arbiter](https://protocol.statechannels.org/docs/contract-devs/force-move#methods) of valid state transitions in the case of disputed contract close, or if one party goes offline. The mechanics of a non-happy-path contract close are all included "for free" in the Nitro Protocol, implemented by "State Channels."

This demo does not implement the full mechanics we desire, but demonstrates the feasibility of implementing them in the constraints of the "State Channels" architecture. The implementation _does_ include basic data structures used to model the Suggester and User roles and capabilities. It also encodes some initial rules, such as:

* Only the User can Pay or Burn the Suggester during the React Phase
* The only valid funding addresses are the User's address, the Suggester's address, and the Burn address and they can't change
* The core parameters (i.e. the reward & burn rates) are not allowed to change once the channel is open

While this codebase lacks other mechanics— such as forcing each state transition to include the appropriate change in balances— these would be straightforward to implement given the capabilities demonstrated her.

### Tests

There are two tests implemented in `scorched-earth-test.ts`, One to demonstrate an end-to-end interaction between a User & Suggester, and the other to demonstrate the contract is enforcing our encoded logic on-chain.

The [latter](https://github.com/ScopeLift/scorched-earth/blob/master/channels-testing/test/scorched-earth-test.ts#L432) is straightforward. It merely attempts an illegal state transition— one that fails to toggle between the Share and React phases— and demonstrates the contract decodes our off-chain data structures and throws the appropriate error.

The [former](https://github.com/ScopeLift/scorched-earth/blob/master/channels-testing/test/scorched-earth-test.ts#L124) is more involved. It actually has the  User and Suggester open a channel, carry out two mock suggest/respond interactions, then close the channel and disperse balances.

There are two pre-frunding setup states (one per participant), followed by on-chain funds deposit by each party, followed by two post-funding setup states. Afterwards, we simulate two suggest/respond interaction. The User rewards the Suggester for the first, burns both of their funds on the second, then both coordinate to close the channel amicably.

The tests checkpoint on-chain after each interaction as a sanity check, but this would not be needed in the real system. After the channel is closed, the tests verify appropriate funds have been dispersed to the User, Suggester, and the beneficiary address of the "burned" funds.


## Running Locally

To run the tests which constitute this demonstration, you must have `node` and `npm` installed. The demo has been tested with `node` `v12.16.1` and `npm` `6.13.4`, running on macOS `10.14`.

Clone the repo, navigate to the `channels-testing` directory, and run the expected commands:

```bash
git clone https://github.com/ScopeLift/scorched-earth.git
cd scorched-earth/channels-testing
npm install
npm test
```

## Current Limitations And Implementation Details

* The code herein is pretty rough: the demo tests are not DRY and have lots of hardcoded values, naming in the tests and the contracts is poor. All will be improved for the real implementation.
* As already mentioned, this demo does not implement the full mechanics of ScorchedEarth interactions.
* For simplicity, the test demo funds the channel with ETH, but ERC20 tokens are fully supported by "State Channels."
* The demo does not consider the off-chain communication method (https vs. websockets, etc...) between the User or Suggester. This will be an implementation detail of our system.
* The Suggester does not sign two states (one reward, one burn) and return them to the User, which would allow the User to choose which option. Instead:
  1. The Suggester pessimistically updates everyone's balances as if the User has chosen to Burn during each Suggest Phase.
  2. In the React Phase, the user can choose to Burn, which locks in these these balances
  3. Alternatively, the user can choose to Pay (i.e. reward), by updating balances appropriately.
  4. Though not done so in this demo, the `validTransition` function can be encoded to only allow updates at each step that are in accordance with the reward/burn amounts agreed upon at the opening of the channel.