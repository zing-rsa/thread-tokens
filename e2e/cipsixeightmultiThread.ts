import {
    SpendingValidator,
    MintingPolicy,
    PrivateKey,
    Emulator,
    Address,
    Assets,
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
    ThreadValidatorParams,
    ThreadPolicyParams,
    MetaPolicyParams,
    TokenPolicyParams,
    MetaPolicyInfo,
    ThreadValidatorInfo,
    ThreadDatum,
    TokenPolicyInfo,
    Action,
    OutRef,
ThreadDatumShape,
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
            ThreadPolicyParams
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

function getMetaVal(info: MetaPolicyInfo): SpendingValidator {

    if (!metaVal) throw new Error('Meta validator not found'); 

    return {
        "type": "PlutusV2", 
        "script": applyParamsToScript<MetaPolicyParams>(
            metaVal.compiledCode,
            [info],
            MetaPolicyParams
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
            ThreadPolicyParams
        )
    }
}

// ----------------------------------------------------------------------
// helper functions

async function setup() {

    const THREAD_COUNT = 2
    const MAX_SUPPLY = 10
    const OWNERSHIP_NAME = 'ownership'
    const TOKEN_NAME = 'token'
     
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
    const meta_val_address = lucidLib.utils.validatorToAddress(meta_val)

    const token_policy_info: TokenPolicyInfo = {
        thread_policy: thread_policy_id, 
        token_prefix: fromText(TOKEN_NAME),
        token_id_leftpad: BigInt(2),
        max_supply: BigInt(MAX_SUPPLY),
        thread_count: BigInt(THREAD_COUNT),
        meta_val: meta_val_hash,
        owner_policy: ownership_policy_id,
        owner_name: fromText(OWNERSHIP_NAME)
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
        TOKEN_NAME,
        lucid,
        address1,
        user1,
        address2,
        user2,
        addr1_utxo,
        thread_policy,
        thread_policy_id,
        thread_validator,
        thread_validator_address,
        token_policy,
        token_policy_id,
        emulator,
        meta_val,
        meta_val_address,
        ownership_policy,
        ownership_policy_id,
    }
}

async function setupForBurn(
    THREAD_COUNT: number,
    MAX_SUPPLY: number,
    OWNERSHIP_NAME: string,
    TOKEN_NAME: string,
) {

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
        token_prefix: fromText(TOKEN_NAME),
        token_id_leftpad: BigInt(2),
        max_supply: BigInt(MAX_SUPPLY),
        thread_count: BigInt(THREAD_COUNT),
        meta_val: meta_val_hash,
        owner_policy: ownership_policy_id,
        owner_name: fromText(OWNERSHIP_NAME)
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
        TOKEN_NAME,
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
        token_policy_id,
        emulator,
        meta_val,
        ownership_policy,
        ownership_policy_id,
    }
}

function left_pad(size: number, s: string): string {
    let out = s; 
    for (let i = 0; i < size - s.length; i++) {
        out = '0' + out
    } 
    return out
}

// testing
// ------------------------------------------------------------------------
//

async function mintOne() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        OWNERSHIP_NAME,
        lucid,
        user1,
        addr1_utxo,
        thread_policy,
        thread_policy_id,
        thread_validator,
        thread_validator_address,
        token_policy,
        token_policy_id,
        emulator,
        meta_val,
        meta_val_address,
        address1,
        address2,
        ownership_policy,
        ownership_policy_id,
    } = await setup()


    // ------------------------------------------
    // transactions 
    //
    
    lucid.selectWalletFromPrivateKey(user1)

    //deploy
    const txBuilder = lucid
        .newTx()
        .collectFrom([addr1_utxo], Data.void())
        .attachMintingPolicy(ownership_policy)
        .mintAssets({
            [toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))]: BigInt(THREAD_COUNT)
        }, Data.void())
        .attachMintingPolicy(thread_policy)
        .mintAssets({
            [toUnit(thread_policy_id, fromText('thread'))] : BigInt(THREAD_COUNT)
        }, Data.void())

    for (let i = 0; i < THREAD_COUNT; i++){
        txBuilder.payToContract(
            thread_validator_address, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatum)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
    }

    const deployTxHash = await txBuilder.complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())

    console.log('deployed: ', deployTxHash)
     
    emulator.awaitBlock(5);

    //mint 
    const thread = (await lucid.utxosAt(thread_validator_address))[0];
    const ownership = (await lucid.utxosAt(address1)).find(o => o.assets[toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))] >= 1)
    if (!ownership) throw new Error('no ownership')

    const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatum) 
    const new_dtm: ThreadDatum = {
        mint_count: locked_thread_dtm.mint_count + 1n,
        idx: locked_thread_dtm.idx
    }

    const mint_id = ((BigInt(MAX_SUPPLY) / BigInt(THREAD_COUNT)) * new_dtm.idx) + new_dtm.mint_count
    const id_text = left_pad(2, mint_id.toString())
    console.log('minting from thread with datum: ', locked_thread_dtm)

    const [utxo] = await lucid.wallet.getUtxos()

    const mintTxHash = await lucid
        .newTx()
        .collectFrom([utxo, thread, ownership], Data.void())
        .attachMintingPolicy(token_policy)
        .mintAssets({
            [toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n,
            [toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n,
        }, Data.to<Action>('Minting', Action))
        .attachSpendingValidator(thread_validator)
        .payToContract(thread_validator_address, 
                       { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatum)},
                       {[toUnit(thread_policy_id, fromText("thread"))] : 1n } )
        .payToContract(meta_val_address,
                       { inline: Data.to<string>(fromText('some metadata'))},
                       {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n})
        .payToAddress(address2,
                       {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n}
        )
        .complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())
    console.log('minted: ', mintTxHash)

    emulator.awaitBlock(5)

    //const updateTx = await updateMetaData(
    //    lucid, 
    //    user1, 
    //    meta_val,
    //    ownership_policy_id,
    //    OWNERSHIP_NAME,
    //    ref_unit
    //)
    //console.log('updated: ', updateTx)

    //emulator.awaitBlock(5)

    //console.log('address2: ', await lucid.utxosAt(address2))
    //console.log('meta: ',     await lucid.utxosAt(lucidLib.utils.validatorToAddress(meta_val)))
}

async function mintAll() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        OWNERSHIP_NAME,
        lucid,
        user1,
        addr1_utxo,
        thread_policy,
        thread_policy_id,
        thread_validator,
        thread_validator_address,
        token_policy,
        token_policy_id,
        emulator,
        meta_val,
        meta_val_address,
        address1,
        address2,
        ownership_policy,
        ownership_policy_id,
    } = await setup()


    // ------------------------------------------
    // transactions 
    //
    
    lucid.selectWalletFromPrivateKey(user1)

    //deploy
    const txBuilder = lucid
        .newTx()
        .collectFrom([addr1_utxo], Data.void())
        .attachMintingPolicy(ownership_policy)
        .mintAssets({
            [toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))]: BigInt(THREAD_COUNT)
        }, Data.void())
        .attachMintingPolicy(thread_policy)
        .mintAssets({
            [toUnit(thread_policy_id, fromText('thread'))] : BigInt(THREAD_COUNT)
        }, Data.void())

    for (let i = 0; i < THREAD_COUNT; i++){
        txBuilder.payToContract(
            thread_validator_address, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatum)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
    }

    const deployTxHash = await txBuilder.complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())

    console.log('deployed: ', deployTxHash)
     
    emulator.awaitBlock(5);

    //mint 
    //
    for (let i = 0; i < MAX_SUPPLY; i++){

        const thread = (await lucid.utxosAt(thread_validator_address)).find(
            (o) => Data.from<ThreadDatum>(o.datum!, ThreadDatum).mint_count < MAX_SUPPLY / THREAD_COUNT
        );
        if (!thread) throw new Error('no thread found')

        const ownership = (await lucid.utxosAt(address1)).find(o => o.assets[toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))] >= 1)
        if (!ownership) throw new Error('no ownership')
    
        const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatum) 
        const new_dtm: ThreadDatum = {
            mint_count: locked_thread_dtm.mint_count + 1n,
            idx: locked_thread_dtm.idx
        }
    
        const mint_id = ((BigInt(MAX_SUPPLY) / BigInt(THREAD_COUNT)) * new_dtm.idx) + new_dtm.mint_count
        const id_text = left_pad(2, mint_id.toString())
        console.log('minting from thread with datum: ', locked_thread_dtm)
    
        const [utxo] = await lucid.wallet.getUtxos()
    
        const mintTxHash = await lucid
            .newTx()
            .collectFrom([utxo, thread, ownership], Data.void())
            .attachMintingPolicy(token_policy)
            .mintAssets({
                [toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n,
                [toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n,
            }, Data.to<Action>('Minting', Action))
            .attachSpendingValidator(thread_validator)
            .payToContract(thread_validator_address, 
                           { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatum)},
                           {[toUnit(thread_policy_id, fromText("thread"))] : 1n } )
            .payToContract(meta_val_address,
                           { inline: Data.to<string>(fromText('some metadata'))},
                           {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n})
            .payToAddress(address2,
                           {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n}
            )
            .complete()
            .then((tx) => tx.sign().complete())
            .then((tx) => tx.submit())
        console.log('minted: ', mintTxHash)
    
        emulator.awaitBlock(5)

    }

}

async function mintTooMany() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        OWNERSHIP_NAME,
        lucid,
        user1,
        addr1_utxo,
        thread_policy,
        thread_policy_id,
        thread_validator,
        thread_validator_address,
        token_policy,
        token_policy_id,
        emulator,
        meta_val,
        meta_val_address,
        address1,
        address2,
        ownership_policy,
        ownership_policy_id,
    } = await setup()


    // ------------------------------------------
    // transactions 
    //
    
    lucid.selectWalletFromPrivateKey(user1)

    //deploy
    const txBuilder = lucid
        .newTx()
        .collectFrom([addr1_utxo], Data.void())
        .attachMintingPolicy(ownership_policy)
        .mintAssets({
            [toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))]: BigInt(THREAD_COUNT)
        }, Data.void())
        .attachMintingPolicy(thread_policy)
        .mintAssets({
            [toUnit(thread_policy_id, fromText('thread'))] : BigInt(THREAD_COUNT)
        }, Data.void())

    for (let i = 0; i < THREAD_COUNT; i++){
        txBuilder.payToContract(
            thread_validator_address, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatum)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
    }

    const deployTxHash = await txBuilder.complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())

    console.log('deployed: ', deployTxHash)
     
    emulator.awaitBlock(5);

    //mint 
    //
    for (let i = 0; i < MAX_SUPPLY + 1; i++){

        let thread = (await lucid.utxosAt(thread_validator_address)).find(
            (o) => Data.from<ThreadDatum>(o.datum!, ThreadDatum).mint_count < MAX_SUPPLY / THREAD_COUNT
        );
        if (!thread) thread = (await lucid.utxosAt(thread_validator_address))[0]

        const ownership = (await lucid.utxosAt(address1)).find(o => o.assets[toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))] >= 1)
        if (!ownership) throw new Error('no ownership')
    
        const locked_thread_dtm = Data.from<ThreadDatum>(thread!.datum!, ThreadDatum) 
        const new_dtm: ThreadDatum = {
            mint_count: locked_thread_dtm.mint_count + 1n,
            idx: locked_thread_dtm.idx
        }
    
        const mint_id = ((BigInt(MAX_SUPPLY) / BigInt(THREAD_COUNT)) * new_dtm.idx) + new_dtm.mint_count
        const id_text = left_pad(2, mint_id.toString())
        console.log('minting from thread with datum: ', locked_thread_dtm)
    
        const [utxo] = await lucid.wallet.getUtxos()
    
        const mintTxHash = await lucid
            .newTx()
            .collectFrom([utxo, thread, ownership], Data.void())
            .attachMintingPolicy(token_policy)
            .mintAssets({
                [toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n,
                [toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n,
            }, Data.to<Action>('Minting', Action))
            .attachSpendingValidator(thread_validator)
            .payToContract(thread_validator_address, 
                           { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatum)},
                           {[toUnit(thread_policy_id, fromText("thread"))] : 1n } )
            .payToContract(meta_val_address,
                           { inline: Data.to<string>(fromText('some metadata'))},
                           {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n})
            .payToAddress(address2,
                           {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 222)]: 1n}
            )
            .complete()
            .then((tx) => tx.sign().complete())
            .then((tx) => tx.submit())
        console.log('minted: ', mintTxHash)
    
        emulator.awaitBlock(5)

    }
}

async function mintWrongLabels() {
    
    const {
        THREAD_COUNT,
        MAX_SUPPLY,
        OWNERSHIP_NAME,
        lucid,
        user1,
        addr1_utxo,
        thread_policy,
        thread_policy_id,
        thread_validator,
        thread_validator_address,
        token_policy,
        token_policy_id,
        emulator,
        meta_val_address,
        address1,
        address2,
        ownership_policy,
        ownership_policy_id,
    } = await setup()


    // ------------------------------------------
    // transactions 
    //
    
    lucid.selectWalletFromPrivateKey(user1)

    //deploy
    const txBuilder = lucid
        .newTx()
        .collectFrom([addr1_utxo], Data.void())
        .attachMintingPolicy(ownership_policy)
        .mintAssets({
            [toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))]: BigInt(THREAD_COUNT)
        }, Data.void())
        .attachMintingPolicy(thread_policy)
        .mintAssets({
            [toUnit(thread_policy_id, fromText('thread'))] : BigInt(THREAD_COUNT)
        }, Data.void())

    for (let i = 0; i < THREAD_COUNT; i++){
        txBuilder.payToContract(
            thread_validator_address, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatum)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
    }

    const deployTxHash = await txBuilder.complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())

    console.log('deployed: ', deployTxHash)
     
    emulator.awaitBlock(5);

    //mint 
    const thread = (await lucid.utxosAt(thread_validator_address))[0];
    const ownership = (await lucid.utxosAt(address1)).find(o => o.assets[toUnit(ownership_policy_id, fromText(OWNERSHIP_NAME))] >= 1)
    if (!ownership) throw new Error('no ownership')

    const locked_thread_dtm = Data.from<ThreadDatum>(thread.datum!, ThreadDatum) 
    const new_dtm: ThreadDatum = {
        mint_count: locked_thread_dtm.mint_count + 1n,
        idx: locked_thread_dtm.idx
    }

    const mint_id = ((BigInt(MAX_SUPPLY) / BigInt(THREAD_COUNT)) * new_dtm.idx) + new_dtm.mint_count
    const id_text = left_pad(2, mint_id.toString())
    console.log('minting from thread with datum: ', locked_thread_dtm)

    const [utxo] = await lucid.wallet.getUtxos()

    const mintTxHash = await lucid
        .newTx()
        .collectFrom([utxo, thread, ownership], Data.void())
        .attachMintingPolicy(token_policy)
        .mintAssets({
            [toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n,
            [toUnit(token_policy_id, fromText('token') + fromText(id_text), 101)]: 1n,
        }, Data.to<Action>('Minting', Action))
        .attachSpendingValidator(thread_validator)
        .payToContract(thread_validator_address, 
                       { inline: Data.to<ThreadDatum>(new_dtm, ThreadDatum)},
                       {[toUnit(thread_policy_id, fromText("thread"))] : 1n } )
        .payToContract(meta_val_address,
                       { inline: Data.to<string>(fromText('some metadata'))},
                       {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 100)]: 1n})
        .payToAddress(address2,
                       {[toUnit(token_policy_id, fromText('token') + fromText(id_text), 101)]: 1n}
        )
        .complete()
        .then((tx) => tx.sign().complete())
        .then((tx) => tx.submit())
    console.log('minted: ', mintTxHash)

    emulator.awaitBlock(5)

}

async function tryBurn() {
}

async function tryTwoThreads() {
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
     Deno.test('mint too many', () => testFails(mintTooMany))
     Deno.test('mint with wrong label', () => testFails(mintWrongLabels))
     //Deno.test('update metadata', () => testSuceeds(tryUpdate))
     //Deno.test('burn', () => testSuceeds(() => tryBurn(
     //  1,
     //  10,
     //  'ownership',
     //  'token',
     //  1
     //)))
     //Deno.test('try spent 2 threads', () => testFails(() => tryTwoThreads()))
    
     Deno.test('leftpad1', () => { if(left_pad(2, '1') != '01') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(2, '10') != '10') throw new Error('wrong') } )
     Deno.test('leftpad1', () => { if(left_pad(4, '100') != '0100') throw new Error('wrong') } )
}

main();
