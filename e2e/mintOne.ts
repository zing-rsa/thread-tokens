import {
    SpendingValidator,
    MintingPolicy,
    PrivateKey,
    Emulator,
    Address,
    Lucid,
    Data,
    UTxO,
    Unit,
    applyParamsToScript,
    generatePrivateKey,
    fromText,
} from 'lucid'
import {
    ThreadValidatorParamsShape,
    ThreadValidatorParams,
    ThreadPolicyParamsShape,
    ThreadPolicyParams,
    TokenPolicyParamsShape,
    TokenPolicyParams,
    ThreadValidatorInfo,
    TokenPolicyInfo,
    ThreadDatumShape,
    ThreadDatum,
    OutRef,
} from './types.ts'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const threadPolicyCode = plutus.validators.find(v => v.title == "thread.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token.mint")

// ------------------------------------------------------------------------
// policy compilation

function getThreadPolicy(utxo: UTxO): MintingPolicy {

    if (!threadPolicyCode) throw new Error('Thread policy code not found'); 

    const plutus_out_ref: OutRef  = {
        transaction_id: { hash: utxo.txHash },
        output_index: BigInt(utxo.outputIndex)
    }

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<ThreadPolicyParams>(
            threadPolicyCode.compiledCode,
            [plutus_out_ref],
            ThreadPolicyParamsShape
        )
    }
}

function getThreadValidator(info: ThreadValidatorInfo): SpendingValidator {

    if (!threadValidatorCode) throw new Error('Thread validator code not found'); 

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<ThreadValidatorParams>(
            threadValidatorCode.compiledCode,
            [info],
            ThreadValidatorParamsShape
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
            TokenPolicyParamsShape
        )
    }
}

// ------------------------------------------------------------------------
// helper functions


async function deploy(lucid: Lucid, userKey: PrivateKey, policy: MintingPolicy, valAddr: Address, dtm: ThreadDatum, utxo: UTxO) {
    lucid.selectWalletFromPrivateKey(userKey);

    const thread_token: Unit = lucidLib.utils.mintingPolicyToId(policy) + fromText("thread") 

    const asset = { [thread_token] : 1n }

    console.log('mint thread using: ', `${utxo.txHash}#${utxo.outputIndex}`)

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .mintAssets(asset, Data.void())
        .attachMintingPolicy(policy)
        .payToContract(valAddr, { inline: Data.to<ThreadDatum>(dtm, ThreadDatumShape)}, asset)
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

async function mint(
    lucid:Lucid,
    user_key:PrivateKey,
    dtm:ThreadDatum,
    thread:UTxO,
    policy:MintingPolicy,
    thread_val: SpendingValidator,
    thread_policy: MintingPolicy
) {
    lucid.selectWalletFromPrivateKey(user_key);

    const thread_token: Unit = lucidLib.utils.mintingPolicyToId(thread_policy) + fromText("thread") 
    const thread_asset = { [thread_token] : 1n }

    const id_text = left_pad(2, dtm.mint_count.toString())

    const token: Unit = lucidLib.utils.mintingPolicyToId(policy) + fromText('token' + id_text)
    const token_asset = { [token] : 1n }

    const thread_val_addr = lucidLib.utils.validatorToAddress(thread_val)

    const [utxo] = await lucid.wallet.getUtxos()

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .collectFrom([thread], Data.void())
        .attachMintingPolicy(policy)
        .mintAssets(token_asset, Data.to(dtm.mint_count))
        .attachSpendingValidator(thread_val)
        .payToContract(thread_val_addr, { inline: Data.to<ThreadDatum>(dtm, ThreadDatumShape)}, thread_asset)
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return txHash;
}

function left_pad(size: number, s: string): string {
    let out = s; 
    for (let i = 0; i < size - s.length; i++) {
        out = '0' + out
    } 
    return out
}

// ------------------------------------------------------------------------
// testing

async function run() {

    //---------------------------------------
    // setup
     
    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    console.log('address1', address1)
    
    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    console.log('address2', address2)

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 100000000n }},
        { address: address2, assets: { lovelace: 100000000n }}
    ]);
    const lucid = await Lucid.new(emulator);

    const [addr1_utxo] = await lucid.utxosAt(address1)
    const thread_policy = getThreadPolicy(addr1_utxo)
    const thread_policy_id = lucidLib.utils.mintingPolicyToId(thread_policy);
    console.log('thread policy: ', thread_policy_id)

    const token_policy_info: TokenPolicyInfo = {
        thread_policy: thread_policy_id, 
        token_prefix: fromText("token"),
        max_supply: 10n
    }
    const token_policy = getTokenPolicy(token_policy_info)
    const token_policy_id = lucidLib.utils.mintingPolicyToId(token_policy)
    console.log('token policy: ', token_policy_id)
    
    const thread_val_info: ThreadValidatorInfo = {
        token_policy: token_policy_id,
        thread_policy: thread_policy_id,
    } 
    const thread_validator = getThreadValidator(thread_val_info)
    const thread_validator_address = lucidLib.utils.validatorToAddress(thread_validator)
    console.log('thread validator: ', thread_validator_address)

    console.log('start state address1: ', await lucid.utxosAt(address1))
    console.log('start state address2: ', await lucid.utxosAt(address2))

    // ------------------------------------------
    // transactions 
     
    const thread_dtm: ThreadDatum = {
        mint_count: 0n
    } 
    const deployTx = await deploy(lucid, user1, thread_policy, thread_validator_address, thread_dtm, addr1_utxo)
    console.log('deployed: ', deployTx);

    emulator.awaitBlock(5);

    console.log('address1: ', await lucid.utxosAt(address1))
    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('threadaddress: ', await lucid.utxosAt(thread_validator_address))
    
    const [thread] = await lucid.utxosAt(thread_validator_address);
    const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatumShape) 

    console.log('found datum: ', locked_thread_dtm)
    const new_dtm: ThreadDatum = {
        mint_count: locked_thread_dtm.mint_count + 1n
    }
    
    const mintTx = await mint(lucid, user2, new_dtm, thread, token_policy, thread_validator, thread_policy)
    console.log('minted: ', mintTx)

    emulator.awaitBlock(5)

    console.log('address1 utxo:  ', await lucid.utxosAt(address1))
    console.log('address2 utxo:  ', await lucid.utxosAt(address2))
}

// -----------------------------------------------------------------------------
// wrappers

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

// ------------------------------------------------------------------------------
// main

function main() {
     Deno.test('mint one', () => testSuceeds(run));
    
     Deno.test('leftpad1', () => { if(left_pad(2, '1') != '01') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(2, '10') != '10') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(4, '100') != '0100') throw new Error('wrong') } )
}

main();

