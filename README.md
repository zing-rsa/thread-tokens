
## thread-tokens

This is a collection of scripts which faciliate capped and immutable token minting without the need for timelocking the minting policy.

### Goals 
- no timelocking
    - the policy is not required to be timelocked because tokens are instead tied to long lasting state(utxos) on chain
- parallel minting
    - multiple thread tokens allow multiple mints per block
- token name governed onchain
    - token name increments are governed by onchain logic
- implement cip68
    - mint a ref token and user token
    - ref token contains metadata datum
    - user token is token in users wallet
- metadata control
    - owners should be able to update metadata
    - will require an ownership token
    - will require the ref token to be sent to a validator


## Approach

### 3 validators: 

1. token minting contract
    - contains governing logic for tokens
    - checks:
        if minting: 
             - a thread token was consumed
             - the minted tokens have metadata that matches the current state of the thread token
             - the minted tokens do not exceed the max supply
             - both a ref and user token are minted(cip68)
             - ref token is sent to control address
        if burning: 
            - the count of mint is < 0
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


## CIP68
- mint validator must check that ref and user token are minted
    - one of each
    - same names 
    - correct prefixes
- both tokens required to come from the same policy


## Ownership
- mint an ownership token that is a param of the minting policy
- this token is required to be spent for the metadata control policy
    - meta control validator is parameterized by this token
    - must spend this token to spend a metadata/ref utxo

    
todo: 
    - add metadata check to token_policy
        - checks ref has valid meta
    - value paid to owner?
        - check that ada is transfered in exchange for nft

## Issues
    - SOLVED: could you say you are minting but instead burn? 
        - no, the policy checks that the value of ref and user is 1 each 
    - SOLVED: could 2 thread tokens end up in the same utxo?
        - adapted thread token to enforce only a single utxo and token can be consumed 
    - SOLVED: consume a thread by burning a token?
        - made sure in thread that token mint is positive(== 1)
    - Currently the script is setup with the goal of allowing minting transactions from the frontend
        - this might need to be re-thought slightly because the metadata utxo must not be minted by the frontend
        - 2 solutions: 
            - mint the ref utxo at another stage
            - manage minting completely on the backend(going with this for now)

