# Scorched Earth

**Decentralized Content Suggestions Using Two Of Two Scorched Earth**.

The goal of the project is to deliver a proof-of-concept implementation and demonstration of the Two of Two Scorched Earth mechanism, in the hopes of convincing other would-be product builders that it can be useful in their applications. The project is supported by a grant from the [Ethereum Foundation](https://ethereum.org/en/foundation/).

The mechanism in question was proposed by Vitalik Buterin in a September 2018 ETH Research post titled [List of primitives useful for using cryptoeconomics-driven internet / social media applications](https://ethresear.ch/t/list-of-primitives-useful-for-using-cryptoeconomics-driven-internet-social-media-applications/3198). In the post, Buterin credits Oleg Andreev for the [original idea](https://blog.oleganza.com/post/58240549599/contracts-without-trust-or-third-parties).

The core premise of the scheme is a behavioral "resentment" assumption. Briefly, if a buyer has the opportunity to punish a dishonest seller, even if it causes harm to themselves, they will do so.

Our hypothesis is that if the seller knows this possibility exists, they will be unlikely to provide a good or service they know to be subpar. In order to test this, we propose the following experiment.


## High Level Product Description

The system has two roles: a User and a Suggester. The User looks at pictures and the Suggester suggests them.

Suggesters make deposits into a main-chain smart contract as escrow to cover the creation of payment channels. Users can view available Suggesters and choose to open a channel. When the User makes their own deposit, the contract uses a portion of the Suggester's escrow to create a 1-to-1 channel between the two.

Before the channel is officially open, it must be approved by the Suggester. Suggesters can do this automatically— but at a rate limited frequency— to mitigate sybil/spam attacks.

The Suggester recommends a piece of content for the User's consumption, for example, the URL of an image for a funny meme. The User can respond in one of two ways:

 * If satisfied, the User pays Suggester the reward amount
 * If dissatisfied, the User and Suggester are both burned pre-determined amounts

The process repeats until the User chooses to end, or the Suggester runs out of content.

**For a more detailed description of the envisioned application, including user stories and more detailed system mechanics, checkout [SPEC.md](SPEC.md)**.

## Milestones and Progress

Here's an overview of the high level project milestones and current progress:

✅ Find An Appropriate State Channel Implementation (see [channels-testing/README.md](channels-testing/README.md)) <br />
◻️ Smart Contracts And Tests (🚧) <br />
◻️Suggester Backend <br />
◻️User UI <br />
◻️Soft launch on mainnet


