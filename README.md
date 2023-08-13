
## thread-tokens

This is a collection of scripts which faciliate capped and immutable token minting without the need for timelocking the minting policy.

### Features
- no timelocking
    - the policy is not required to be timelocked because tokens are instead tied to long lasting state(utxos) on chain
- parallel minting
    - multiple thread tokens allow multiple mints per block
- incremented token names
    - token name incremements are governed by onchain logic

## Approach

### 3 validators: 

1. token minting contract
    - contains governing logic for tokens
    - checks:
        - a thread token was consumed
        - the minted token has metadata that matches the current state of the thread token
        - the minted token does not exceed the max supply
2. thread token minting contract
    - this will only mint the thread token
    - checks: 
        - that a predifined utxo is consumed(for immutability)
3. thread token spend validator
    - contains thread related logic
    - checks: 
        - a thread token is returned to self
        - the returned thread token is updated correctly
        - a token is minted

