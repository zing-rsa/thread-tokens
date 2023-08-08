
## thread-tokens

This is a collection of scripts which faciliate capped and immutable token minting without the need for timelocking the minting policy.

## Approach

### 3 validators: 

1. token minting contract
    - this will only mint the token
    - checks:
        - a thread token was consumed
2. thread token minting contract
    - this will only mint the thread token
    - checks: 
        - that a predifined utxo is consumed(for immutability)
3. thread token spend validator
    - this will contain most of the logic
    - checks: 
        - a thread token is returned to self
        - the returned thread token is updated correctly
        - a token is minted
        - the minted token has metadata that matches the current state of the thread token


