# Decentralized Content Suggestions Using Two Of Two Scorched Earth

## Intro

This document specifies the implementation of a decentralized system for peer-to-peer content suggestion utilizing a "Two Of Two Scorched Earth" reward/punishment scheme. The goal of the project is to deliver a proof-of-concept  implementation and demonstration in the hopes of convincing other would-be product builders that this mechanism can be useful in their applications.

The mechanism in question was proposed by Vitalik Buterin in a September 2018 ETH Research post titled [List of primitives useful for using cryptoeconomics-driven internet / social media applications](https://ethresear.ch/t/list-of-primitives-useful-for-using-cryptoeconomics-driven-internet-social-media-applications/3198). In the post, Buterin credits Oleg Andreev for the [original idea](https://blog.oleganza.com/post/58240549599/contracts-without-trust-or-third-parties).

The core premise of the scheme is a behavioral "resentment" assumption. Briefly, if a buyer has the opportunity to punish a dishonest seller, even if it causes harm to themselves, they will do so.

Our hypothesis is that if the seller knows this possibility exists, they will be unlikely to provide a good or service they know to be subpar. In order to test this, we propose the following experiment.

## High Level Product Description

The system has two roles: a User and a Suggester. The User looks at pictures and the Suggester suggests them.

Suggesters make deposits into a main-chain smart contract as escrow to cover the creation of payment channels. Users can view available suggesters and choose to open a channel. When the User makes their own deposit, the contract uses a portion of the Suggester's escrow to create a 1-to-1 channel between the two.

Before the channel is officially open, it must be approved by the Suggester. Suggesters can do this automatically— but at a rate limited frequency— to mitigate sybil/spam attacks.

The Suggester recommends a piece of content for the User's consumption, for example, the URL of an image for a funny meme. Along with the URL, the suggester offers two possible signed channel updates.

* State 1 (If the user is satisfied with the content shared)
    * User pays Suggester the reward amount
* State 2 (If the user is dissatisfied with the content shared)
    * User and Suggester are both burned pre-determined amounts

The User chooses which message to sign one and sends it back to the Suggester. From then all future states are build upon the pervious state. The process repeats

## Suggester story

1. A Suggester deposits funds into a smart contract escrow account and advertises several properties in the contract state. These can be updated as needed.
   * The URL of their suggester server
   * Their rate, i.e. the reward per suggestion
   * The amount they're willing to be burned if the User is dissatisfied
   * The amount the User must burn of their own funds to punish the Suggester

2. A User deposits funds and opens a channel with this Suggester.

3. The User then sends a signed "init" message to the Suggester's server. The Suggester server validates the message comes from a User who has opened a channel on the main-chain.

4. The Suggester responds with the URL of an image, plus two updates to the channel state. Here, an "update" represents signed structured data, from which the contract could derive the appropriate balances of the Suggester & User at the time of withdrawal. The two signed states are:
    * State 1 (reward): User pays Suggester the reward amount
    * State 2 (slash): User and Suggester are both burned the pre-determined amounts

5. The User receives this and signs a single message, then sends it back to the Suggester.

6. These rounds continue until either User or Suggester choose to withdraw. During each iteration the Suggester builds on the state chosen & returned by the User.

Note: It is possible for the Suggester and User to collude with one another to unburn their funds.


## User story

1. User visits WEBSITE with web3 enabled browser and is presented with "the UI." It displays a list of available Suggesters sorted by their reputation. (Reputation is a two part score, positive and negative, tied to rewards earned or burned. Details in subsequent sections). It also displays their reward, Suggester burn, and User burn rates.

2. The User selects a Suggester based on their reputation. The User executes a main-chain smart contract interaction to place their deposit into the channel which the contract creates, using a portion of the Suggester's escrow.

3. The User waits until the Suggester consents to their channel. In many cases, this can happen automatically and instantly, but a delay may occur due to rate limiting as a mitigation for sybil attacks.

4. When the transaction is confirmed, the User's UI requests they sign an "init" message and sends it to the Suggester's server. The server responds with a URL for an image and two signed state updates, as defined in the Suggester story above.

5. The User views the image in the UI and selects a from a "Reward" or "Burn" option. The UI presents a request to sign the appropriate state and returns in to the Suggester server. The UI retains all signed states in local storage.


## Withdraw Story

### Mutual Withdrawal

1. In the course of normal operation, either the User or Suggester may send the other a state update that indicates they consider this to be the final state.
    * The User may do this if they've seen enough pictures
    * The Suggester may do this if they're out of photos to share, or no longer wish to service this User.

2. If the other party agrees, they can sign this message as well. Either party may submit the message to the main-chain contract, which updates all balances accordingly. By default, the Suggester server will do this automatically, with frequency limits for DoS protection.

3. If either side fails to sign the final state requested by the other party, a contested withdrawal may take place.

### Contested Withdrawal

1. Either side may initiate a contested withdrawal by submitting transaction to the main-chain that includes:

   * A deposit
   * A state signed by both parties they claim to be final

2. If the other party does not affirm the main-chain state, then the initiator may close the channel after a designated waiting period. All balances are updated to reflect the state, and the initiator gets their deposit back.

3. If the other party disagrees with the initiator that this was the final state, they may submit a challenge transaction to the main-chain smart contract. The challenge will be successful if it includes a more recent state* signed by both parties. If the challenge is successful, the initiator's  deposit is burned, and all other balances are updated to reflect the state of the channel.

      \*Note: User's may only challenge with a state 2 steps newer than the submitted stated. This is to prevent them from holding a signed state from the suggester until the Suggester tries to exit, then signing and penalizing them.

### Reputation

Upon withdrawal, regardless of how the channel is closed, the reputation score of the Suggester is updated. The score has two components:

 * The positive reputation
 * The negative reputation

Upon closing the channel:

 1. 1% of the rewards earned by the Suggester while the channel was open are burned and added to their positive reputation score. This measure mitigates a spam attack.
 2. All Suggester funds burned by the User during their interaction are added to the Suggester funds negative reputation.
