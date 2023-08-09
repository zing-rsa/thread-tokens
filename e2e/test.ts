import {
    Lucid,
    Emulator,
    SpendingValidator,
    PrivateKey,
    Data,
    Address,
    UTxO,
    generatePrivateKey,
    applyParamsToScript,
    MintingPolicy,
    fromText,
    PolicyId,
    Unit
} from 'lucid'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const threadPolicyCode = plutus.validators.find(v => v.title == "thread.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token.mint")


// -----------------------------------------------------------------------
// types

const OutRef = Data.Object({
    transaction_id: Data.Bytes(),
    output_index: Data.Integer()
})
type OutRef = Data.Static<typeof OutRef>

const ThreadPolicyParams = Data.Tuple([
    OutRef
])
type ThreadPolicyParams = Data.Static<typeof ThreadPolicyParams>;


const ThreadPolicyInfo = Data.Object({
  thread_policy: Data.Bytes(),
  token_policy: Data.Bytes(),
  token_prefix: Data.Bytes(),
  max_supply: Data.Integer(),
})
type ThreadPolicyInfo = Data.Static<typeof ThreadPolicyInfo>;

const ThreadValidatorParams = Data.Tuple([
    ThreadPolicyInfo
]);
type ThreadValidatorParams = Data.Static<typeof ThreadValidatorParams>


const TokenPolicyInfo = Data.Object({
    thread_policy: Data.Bytes()    
})
type TokenPolicyInfo = Data.Static<typeof TokenPolicyInfo>

const TokenPolicyParams = Data.Tuple([
    TokenPolicyInfo
])
type TokenPolicyParams = Data.Static<typeof TokenPolicyParams>



const ThreadDatum = Data.Object({
    mint_count: Data.Integer()
}) 
type ThreadDatum = Data.Static<typeof ThreadDatum>;


// ------------------------------------------------------------------------
// policy compilation

function getThreadPolicy(utxo: UTxO): MintingPolicy {

    if (!threadPolicyCode) throw new Error('Thread policy code not found'); 

    const plutus_out_ref: OutRef  = {
        transaction_id: utxo.txHash,
        output_index: BigInt(utxo.outputIndex)
    }

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<ThreadPolicyParams>(
            threadPolicyCode.compiledCode,
            [plutus_out_ref],
            ThreadPolicyParams
        )
    }
}

function getThreadValidator(info: ThreadPolicyInfo): SpendingValidator {

    if (!threadValidatorCode) throw new Error('Thread validator code not found'); 

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<ThreadValidatorParams>(
            threadValidatorCode.compiledCode,
            [info],
            ThreadValidatorParams
        )
    }
}

function getTokenPolicy(info: TokenPolicyInfo): MintingPolicy {

    if (!tokenPolicyCode) throw new Error('Token policy code not found'); 

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<TokenPolicyParams>(
            tokenPolicyCode.compiledCode,
            [info],
            TokenPolicyParams
        )
    }
}

// ------------------------------------------------------------------------
// helper functions


async function deploy(lucid: Lucid, userKey: PrivateKey, policy: MintingPolicy, valAddr: Address, dtm: ThreadDatum) {
    lucid.selectWalletFromPrivateKey(userKey);

    const thread_token: Unit = lucidLib.utils.mintingPolicyToId(policy) + fromText("thread") 

    const asset = { [thread_token] : 1n }

    const tx = await lucid
        .newTx()
        .mintAssets(asset, Data.void())
        .attachMintingPolicy(policy)
        .payToContract(valAddr, { inline: Data.to<ThreadDatum>(dtm, ThreadDatum)}, asset)
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

async function spend(lucid: Lucid, userKey: PrivateKey, utxo: UTxO)   {
    lucid.selectWalletFromPrivateKey(userKey);

//    const tx = await lucid
//        .newTx()
//        .collectFrom([utxo], Data.void())
//        .attachSpendingValidator(validator)
//         //.addSigner()      - addr1
//         //.addSignerKey()   - pubkeyhash
//         //.validFrom()
//        .complete()
//    const txSigned = await tx.sign().complete()
//    const txHash = await txSigned.submit() 
//
//    return txHash;
}


// ------------------------------------------------------------------------
// testing

async function run(testParams: any) {

    //---------------------------------------
    // setup
     
    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    console.log('address1', address1)
    
    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    console.log('address2', address2)

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 10000000n }}
    ]);
    const lucid = await Lucid.new(emulator);

    // create thread policy
    //  use utxo at address for params
    const addr1_utxo = (await lucid.utxosAt(address1))[0]
    const thread_policy = getThreadPolicy(addr1_utxo)
    const thread_policy_id = lucidLib.utils.mintingPolicyToId(thread_policy);
    console.log('thread policy: ', thread_policy_id)

    // create the token policy  
    //  use the threadpolicy for params
    const token_policy_info: TokenPolicyInfo = {
        thread_policy: thread_policy_id
    }
    const token_policy = getTokenPolicy(token_policy_info)
    const token_policy_id = lucidLib.utils.mintingPolicyToId(token_policy)
    console.log('token policy: ', token_policy_id)
    
    // create the thread val
    //  use thread pol and token pol for params
    const thread_val_info: ThreadPolicyInfo = {
        token_policy: token_policy_id,
        thread_policy: thread_policy_id,
        token_prefix: fromText("token"),
        max_supply: 10n

    } 
    const thread_validator = getThreadValidator(thread_val_info)
    const thread_validator_address = lucidLib.utils.validatorToAddress(thread_validator)
    console.log('thread validator: ', thread_validator_address)

    // tx: addr1 
    //  mint a thread token
    //  create dtm
    //  pay the thread token to the thread val
    const thread_dtm: ThreadDatum = {
        mint_count: 0n
    } 
    const deployTx = deploy(lucid, user1, thread_policy, thread_validator_address, thread_dtm)
    console.log('deployed: ', deployTx);


    //
    // tx: addr2
    //  get dtm from thread val
    //   increment
    //  consume thread
    //  pay thread back
    //   new dtm
    //  mint token
    //   pay token to self



//    const dtm = {
//        
//    }
//
//    const lockTx = await lock(lucid, user1, dtm, scriptAddress);
//    console.log('locked: ', lockTx)
//
//    const spendTx = await spend(lucid, user2, utxoToSpend);
//    console.log('spent: ', spendTx)

}


async function testFails( test: any ) {
        let throws = false;
        try {
            await test() 
        } catch (_e) {
            throws = true;
        }
        
        if (!throws) {
            throw new Error("Test did not fail as expected");
        }
}
    
 async function testSuceeds( test: any) {
   await test() 
}

function main() {
   Deno.test('', () => testSuceeds(run));
   Deno.test('', () => testSuceeds(run));
   Deno.test('', () => testFails(run));
}

main();

