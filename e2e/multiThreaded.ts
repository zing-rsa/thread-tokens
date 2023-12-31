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
    ThreadDatumShape,
    ThreadDatum,
    TokenPolicyInfo,
    OutRef,
} from './types_multi.ts'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const threadPolicyCode = plutus.validators.find(v => v.title == "thread_multi.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread_multi.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token_multi.mint")

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

// ----------------------------------------------------------------------
// helper functions

async function deploy(lucid:
    Lucid,
    userKey:PrivateKey,
    policy:MintingPolicy,
    valAddr:Address,
    utxo:UTxO,
    thread_count:number
) {
    lucid.selectWalletFromPrivateKey(userKey);

    const thread_token: Unit = lucidLib.utils.mintingPolicyToId(policy) + fromText("thread") 
    const thread_asset = { [thread_token] : 1n }
    const thread_assets = { [thread_token] : BigInt(thread_count)}

    console.log('mint thread using: ', `${utxo.txHash}#${utxo.outputIndex}`)

    const txBuilder = lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .mintAssets(thread_assets, Data.void())
        .attachMintingPolicy(policy)

    for (let i = 0; i < thread_count; i++){
        txBuilder.payToContract(
            valAddr, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatumShape)
            }, 
            thread_asset) 
    }

    const tx = await txBuilder.complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

async function mint(
    lucid:Lucid,
    user_key:PrivateKey,
    thread:UTxO,
    policy:MintingPolicy,
    thread_val: SpendingValidator,
    thread_policy: MintingPolicy,
    max_supply: number,
    thread_count: number
) {
    lucid.selectWalletFromPrivateKey(user_key);

    const thread_token: Unit = lucidLib.utils.mintingPolicyToId(thread_policy) + fromText("thread") 
    const thread_asset = { [thread_token] : 1n }

    const thread_val_addr = lucidLib.utils.validatorToAddress(thread_val)

    const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatumShape) 

    console.log('minting from thread with datum: ', locked_thread_dtm)

    const new_dtm: ThreadDatum = {
        mint_count: locked_thread_dtm.mint_count + 1n,
        idx: locked_thread_dtm.idx
    }

    const mint_id = ((BigInt(max_supply) / BigInt(thread_count)) * new_dtm.idx) + new_dtm.mint_count

    const id_text = left_pad(2, mint_id.toString())

    const token: Unit = lucidLib.utils.mintingPolicyToId(policy) + fromText('token' + id_text)
    const token_asset = { [token] : 1n }

    const [utxo] = await lucid.wallet.getUtxos()

    const tx = await lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .collectFrom([thread], Data.void())
        .attachMintingPolicy(policy)
        .mintAssets(token_asset, Data.to(mint_id))
        .attachSpendingValidator(thread_val)
        .payToContract(thread_val_addr, { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatumShape)}, thread_asset)
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

async function setup() {

    const THREAD_COUNT = 2
    const MAX_SUPPLY = 10
     
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
        max_supply: BigInt(MAX_SUPPLY),
        thread_count: BigInt(THREAD_COUNT)
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

    return {
        THREAD_COUNT,
        MAX_SUPPLY,
        lucid,
        address1,
        user1,
        address2,
        user2,
        addr1_utxo,
        thread_policy,
        thread_validator,
        thread_validator_address,
        token_policy,
        emulator,
    }
}

// ------------------------------------------------------------------------
// testing
//

async function mintOne() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        lucid,
        user1,
        user2,
        addr1_utxo,
        thread_policy,
        thread_validator,
        thread_validator_address,
        token_policy,
        emulator,
    } = await setup()

    // ------------------------------------------
    // transactions 
     
    const deployTx = await deploy(
        lucid,
        user1,
        thread_policy,
        thread_validator_address,
        addr1_utxo,
        THREAD_COUNT
    )
    console.log('deployed: ', deployTx);

    emulator.awaitBlock(5);

    const thread = (await lucid.utxosAt(thread_validator_address))[0];
    
    const mintTx = await mint(
        lucid,
        user2,
        thread,
        token_policy,
        thread_validator,
        thread_policy,
        MAX_SUPPLY,
        THREAD_COUNT
    )
    console.log('minted: ', mintTx)

    emulator.awaitBlock(5)

}

async function mintAll() {

    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        lucid,
        user1,
        user2,
        addr1_utxo,
        thread_policy,
        thread_validator,
        thread_validator_address,
        token_policy,
        emulator,
    } = await setup()

    // ------------------------------------------
    // transactions 
     
    const deployTx = await deploy(
        lucid,
        user1,
        thread_policy,
        thread_validator_address,
        addr1_utxo,
        THREAD_COUNT
    )
    console.log('deployed: ', deployTx);

    emulator.awaitBlock(5);

    for (let t = 0; t < MAX_SUPPLY; t++){
        const thread = (await lucid.utxosAt(thread_validator_address)).find(
            (o) => Data.from<ThreadDatum>(o.datum!, ThreadDatumShape).mint_count < MAX_SUPPLY/THREAD_COUNT 
        );

        if (!thread) throw new Error('Unable to find suitable thread')

        const mintTx = await mint(
            lucid,
            user2,
            thread,
            token_policy,
            thread_validator,
            thread_policy,
            MAX_SUPPLY,
            THREAD_COUNT
        )
        console.log('minted: ', mintTx)

        emulator.awaitBlock(5)
    }

}

async function mintTooMany() {

    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        lucid,
        user1,
        user2,
        addr1_utxo,
        thread_policy,
        thread_validator,
        thread_validator_address,
        token_policy,
        emulator,
    } = await setup()

    // ------------------------------------------
    // transactions 
     
    const deployTx = await deploy(
        lucid,
        user1,
        thread_policy,
        thread_validator_address,
        addr1_utxo,
        THREAD_COUNT
    )
    console.log('deployed: ', deployTx);

    emulator.awaitBlock(5);

    for (let t = 0; t < MAX_SUPPLY; t++){
        const thread = (await lucid.utxosAt(thread_validator_address)).find(
            (o) => Data.from<ThreadDatum>(o.datum!, ThreadDatumShape).mint_count < MAX_SUPPLY/THREAD_COUNT
        );

        if (!thread) throw new Error('Unable to find suitable thread')

        const mintTx = await mint(
            lucid,
            user2,
            thread,
            token_policy,
            thread_validator,
            thread_policy,
            MAX_SUPPLY,
            THREAD_COUNT
        )
        console.log('minted: ', mintTx)

        emulator.awaitBlock(5)
    }
    
    // mint one more
    const [thread] = (await lucid.utxosAt(thread_validator_address));

    if (!thread) throw new Error('Unable to find suitable thread')

    const mintTx = await mint(
        lucid,
        user2,
        thread,
        token_policy,
        thread_validator,
        thread_policy,
        MAX_SUPPLY,
        THREAD_COUNT
    )
    console.log('minted: ', mintTx)

    emulator.awaitBlock(5)

}

// -----------------------------------------------------------------------------
// wrappers

async function testFails( test: any ) {
        let throws = false;
        try {
            await test() 
        } catch (e) {
            console.log('Caught error: ', e)
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
     Deno.test('mint one', () => testSuceeds(mintOne));
     Deno.test('mint all', () => testSuceeds(mintAll));
     Deno.test('mint too many', () => testFails(mintTooMany));
    
     Deno.test('leftpad1', () => { if(left_pad(2, '1') != '01') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(2, '10') != '10') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(4, '100') != '0100') throw new Error('wrong') } )
}

main();

