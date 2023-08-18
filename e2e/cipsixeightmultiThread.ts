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
    toUnit
} from 'lucid'
import {
    ThreadValidatorParamsShape,
    ThreadValidatorParams,
    ThreadPolicyParamsShape,
    ThreadPolicyParams,
    MetaPolicyParamsShape,
    MetaPolicyParams,
    TokenPolicyParamsShape,
    TokenPolicyParams,
    MetaPolicyInfo,
    ThreadValidatorInfo,
    ThreadDatumShape,
    ThreadDatum,
    TokenPolicyInfo,
    OutRef,
} from './types_cipsixeightmulti.ts'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const threadPolicyCode = plutus.validators.find(v => v.title == "thread_cipsixeightmulti.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread_cipsixeightmulti.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token_cipsixeightmulti.mint")
const metaVal = plutus.validators.find(v => v.title == "meta.spend")
const ownershipCode = plutus.validators.find(v => v.title == "ownership.mint")

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

function getMetaVal(info: MetaPolicyInfo): SpendingValidator {

    if (!metaVal) throw new Error('Meta validator not found'); 

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<MetaPolicyParams>(
            metaVal.compiledCode,
            [info],
            MetaPolicyParamsShape
        )

    }
}

function getOwnershipPolicy(utxo: UTxO): MintingPolicy {

    if (!ownershipCode) throw new Error('Ownership policy code not found'); 

    const plutus_out_ref: OutRef  = {
        transaction_id: { hash: utxo.txHash },
        output_index: BigInt(utxo.outputIndex)
    }

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<ThreadPolicyParams>(
            ownershipCode.compiledCode,
            [plutus_out_ref],
            ThreadPolicyParamsShape
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

async function deployWithOwnership(
    lucid:Lucid,
    userKey:PrivateKey,
    utxo:UTxO,
    thread_policy:MintingPolicy,
    thread_count:number,
    ownership_policy: MintingPolicy,
    ownership_name: string,
    val_addr:Address,
) {
    lucid.selectWalletFromPrivateKey(userKey);

    const ownership_policy_id = lucidLib.utils.mintingPolicyToId(ownership_policy)
    const thread_policy_id = lucidLib.utils.mintingPolicyToId(thread_policy)

    console.log('mint thread and ownership using: ', `${utxo.txHash}#${utxo.outputIndex}`)

    const txBuilder = lucid
        .newTx()
        .collectFrom([utxo], Data.void())
        .attachMintingPolicy(ownership_policy)
        .mintAssets({
            [toUnit(ownership_policy_id, fromText(ownership_name))]: 1n
        }, Data.void())
        .attachMintingPolicy(thread_policy)
        .mintAssets({
            [toUnit(thread_policy_id, fromText('thread'))] : BigInt(thread_count)
        }, Data.void())

    for (let i = 0; i < thread_count; i++){
        txBuilder.payToContract(
            val_addr, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatumShape)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
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
    thread_mintpolicy: MintingPolicy,
    max_supply: number,
    thread_count: number,
    meta_addr: string
) {
    lucid.selectWalletFromPrivateKey(user_key);

    const token_policy = lucidLib.utils.mintingPolicyToId(policy);
    const thread_policy = lucidLib.utils.mintingPolicyToId(thread_mintpolicy)

    const thread_val_addr = lucidLib.utils.validatorToAddress(thread_val)

    const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatumShape) 

    console.log('minting from thread with datum: ', locked_thread_dtm)

    const new_dtm: ThreadDatum = {
        mint_count: locked_thread_dtm.mint_count + 1n,
        idx: locked_thread_dtm.idx
    }

    const mint_id = ((BigInt(max_supply) / BigInt(thread_count)) * new_dtm.idx) + new_dtm.mint_count

    const id_text = left_pad(2, mint_id.toString())

    const [utxo] = await lucid.wallet.getUtxos()

    const tx = await lucid
        .newTx()
        .collectFrom([utxo, thread], Data.void())
        .attachMintingPolicy(policy)
        .mintAssets({
            [toUnit(token_policy, fromText('token') + fromText(id_text), 100)]: 1n,
            [toUnit(token_policy, fromText('token') + fromText(id_text), 222)]: 1n,
        }, Data.to(mint_id))
        .attachSpendingValidator(thread_val)
        .payToContract(thread_val_addr, 
                       { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatumShape)},
                       {[toUnit(thread_policy, fromText("thread"))] : 1n } )
        .payToContract(meta_addr, 
                       { inline: Data.to<string>(fromText('some metadata'))},
                       {[toUnit(token_policy, fromText('token') + fromText(id_text), 100)]: 1n})
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return {txHash, ref_unit: toUnit(token_policy, fromText('token') + fromText(id_text), 100)};
}

async function updateMetaData(
    lucid:Lucid,
    user_key:PrivateKey,
    meta_val: SpendingValidator,
    ownership_policy_id: string,
    ownership_name: string,
    ref_unit: Unit
) {
    lucid.selectWalletFromPrivateKey(user_key)

    const meta_addr = lucidLib.utils.validatorToAddress(meta_val)

    const ownership_utxo = (await lucid.wallet.getUtxos()).find(
        (o) => o.assets[toUnit(ownership_policy_id, fromText(ownership_name))] == 1n)
    if(!ownership_utxo) throw new Error("couldn't find ownership utxo")

    const [ref_utxo] = (await lucid.utxosAt(meta_addr))
    if(!ref_utxo) throw new Error("couldn't find ref utxo")

    const new_dtm = fromText('somenewMetadata')

    const tx = await lucid
        .newTx()
        .collectFrom([ownership_utxo, ref_utxo], Data.void())
        .attachSpendingValidator(meta_val)
        .payToContract(
            meta_addr, 
            { inline: Data.to<string>(new_dtm)},
            { [ref_unit]: 1n }
        )
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
    const OWNERSHIP_NAME = 'ownership'
     
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

    const ownership_policy = getOwnershipPolicy(addr1_utxo)
    const ownership_policy_id = lucidLib.utils.mintingPolicyToId(ownership_policy);

    const meta_info = {
        ownership_policy: ownership_policy_id,
        ownership_name: fromText(OWNERSHIP_NAME)
    }

    console.log('ownership policy: ', thread_policy_id)
    const meta_val = getMetaVal(meta_info)
    const meta_val_hash = lucidLib.utils.validatorToScriptHash(meta_val)

    const token_policy_info: TokenPolicyInfo = {
        thread_policy: thread_policy_id, 
        token_prefix: fromText("token"),
        max_supply: BigInt(MAX_SUPPLY),
        thread_count: BigInt(THREAD_COUNT),
        meta_val: meta_val_hash
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
        OWNERSHIP_NAME,
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
        meta_val,
        ownership_policy,
        ownership_policy_id,
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
        meta_val,
        address2
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
    
    const {txHash: mintTx} = await mint(
        lucid,
        user2,
        thread,
        token_policy,
        thread_validator,
        thread_policy,
        MAX_SUPPLY,
        THREAD_COUNT,
        lucidLib.utils.validatorToAddress(meta_val)
    )
    console.log('minted: ', mintTx)

    emulator.awaitBlock(5)

    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))
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
        meta_val,
        address2
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

    for (let i = 0; i < MAX_SUPPLY; i++){
        const thread = (await lucid.utxosAt(thread_validator_address))[0];

        const {txHash: mintTx} = await mint(
            lucid,
            user2,
            thread,
            token_policy,
            thread_validator,
            thread_policy,
            MAX_SUPPLY,
            THREAD_COUNT,
            lucidLib.utils.validatorToAddress(meta_val)
        )
        console.log('minted: ', mintTx)

        emulator.awaitBlock(5)
    }

    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))
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
        meta_val,
        address2
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

    for (let i = 0; i < MAX_SUPPLY + 1; i++){
        const thread = (await lucid.utxosAt(thread_validator_address))[0];

        const {txHash: mintTx} = await mint(
            lucid,
            user2,
            thread,
            token_policy,
            thread_validator,
            thread_policy,
            MAX_SUPPLY,
            THREAD_COUNT,
            lucidLib.utils.validatorToAddress(meta_val)
        )
        console.log('minted: ', mintTx)

        emulator.awaitBlock(5)
    }

    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))
}

async function tryUpdate() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        OWNERSHIP_NAME,
        lucid,
        user1,
        user2,
        addr1_utxo,
        thread_policy,
        thread_validator,
        thread_validator_address,
        token_policy,
        emulator,
        meta_val,
        address1,
        address2,
        ownership_policy,
        ownership_policy_id,
    } = await setup()


    // ------------------------------------------
    // transactions 
     
    const deployTx = await deployWithOwnership(
        lucid,
        user1,
        addr1_utxo,
        thread_policy,
        THREAD_COUNT,
        ownership_policy,
        OWNERSHIP_NAME,
        thread_validator_address,
    )
    console.log('deployed: ', deployTx);

    emulator.awaitBlock(5);

    const thread = (await lucid.utxosAt(thread_validator_address))[0];

    const {txHash: mintTx, ref_unit} = await mint(
        lucid,
        user2,
        thread,
        token_policy,
        thread_validator,
        thread_policy,
        MAX_SUPPLY,
        THREAD_COUNT,
        lucidLib.utils.validatorToAddress(meta_val)
    )
    console.log('minted: ', mintTx)

    emulator.awaitBlock(5)

    console.log('address1: ', await lucid.utxosAt(address1))
    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))

    const updateTx = await updateMetaData(
        lucid, 
        user1, 
        meta_val,
        ownership_policy_id,
        OWNERSHIP_NAME,
        ref_unit
    )
    console.log('updated: ', updateTx)

    emulator.awaitBlock(5)

    console.log('address2: ', await lucid.utxosAt(address2))
    console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))
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
     Deno.test('mint all', () => testSuceeds(mintAll))
     Deno.test('mint too many', () => testFails(mintTooMany))
     Deno.test('update metadata', () => testSuceeds(tryUpdate))
    
     Deno.test('leftpad1', () => { if(left_pad(2, '1') != '01') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(2, '10') != '10') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(4, '100') != '0100') throw new Error('wrong') } )
}

main();

