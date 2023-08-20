import { ensureFile } from 'https://deno.land/std/fs/mod.ts'
import {
    SpendingValidator,
    MintingPolicy,
    PrivateKey,
    Emulator,
    Assets,
    Lucid,
    Data,
    UTxO,
    generatePrivateKey,
    fromText,
    toUnit,
    Address,
Unit
} from '../../../repos/lucid/mod.ts'
import {
    ThreadDatum,
    Action,
} from './types.ts'
import {
    getMintFlags,
} from './util.ts'

const lucidLib = await Lucid.new(undefined, "Custom");

async function setupChain(
    debug: boolean,
    threadValidatorAddress: Address,
    threadUnit: Unit,
    threadDatum: ThreadDatum
) {

    let lucid; 
    let address1;
    let user1;
    let emulator;

    if (debug) {
        user1 = generatePrivateKey();
        address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
        
        emulator = new Emulator([
            { 
                address: threadValidatorAddress, 
                assets: { [threadUnit]: 1n }, 
                datum: Data.to<ThreadDatum>(threadDatum, ThreadDatum)
            },
            { address: address1, assets: { lovelace: 100_000_000n } }
        ]);
        lucid = await Lucid.new(emulator);
    } else {
        // need to change this to use a keyfile.json and preprod lucid
        user1 = generatePrivateKey();
        address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
        
        lucid = await Lucid.new(undefined, "Custom");
        throw new Error('not setup for preprod')
    }

    return {lucid, user1, address1, emulator}
}

async function mint(
    lucid:Lucid,
    user_key:PrivateKey,
    thread:UTxO,
    policy:MintingPolicy,
    thread_val: SpendingValidator,
    thread_mintpolicy: MintingPolicy,
    meta_addr: string,
    assets: Assets,
    ref_asset: Assets,
    dtm: ThreadDatum,
) {
    lucid.selectWalletFromPrivateKey(user_key);

    const thread_policy = lucidLib.utils.mintingPolicyToId(thread_mintpolicy)
    const thread_val_addr = lucidLib.utils.validatorToAddress(thread_val)

    const [utxo] = await lucid.wallet.getUtxos()

    const tx = await lucid
        .newTx()
        .collectFrom([utxo, thread], Data.void())
        .attachMintingPolicy(policy)
        .mintAssets(assets, Data.to<Action>('Minting', Action))
        .attachSpendingValidator(thread_val)
        .payToContract(thread_val_addr, 
                       { inline: Data.to<ThreadDatum>(dtm, ThreadDatum)},
                       {[toUnit(thread_policy, fromText("thread"))] : 1n } )
        .payToContract(meta_addr, 
                       { inline: Data.to<string>(fromText('some metadata'))},
                       ref_asset)
        .complete()
    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit() 

    return {txHash};
}

function left_pad(size: number, s: string): string {
    let out = s; 
    for (let i = 0; i < size - s.length; i++) {
        out = '0' + out
    } 
    return out
}

async function main() {
    const flags = getMintFlags() 
    const path = `./${flags.pname}.json`

    await ensureFile(path)
    const projectDetails = JSON.parse(await Deno.readTextFile(path))

    const thread_val_address = lucidLib.utils.validatorToAddress(projectDetails.thread_validator)
    const thread_policy = lucidLib.utils.mintingPolicyToId(projectDetails.thread_policy)
    const token_policy_id = lucidLib.utils.mintingPolicyToId(projectDetails.token_policy)

    const {lucid, user1, emulator} = await setupChain(
        flags.debug,
        thread_val_address,
        toUnit(thread_policy, fromText("thread")),
        { mint_count: 0n, idx: 0n }
    );

    const [utxo] = await lucid.utxosAt(thread_val_address);

    const existing_dtm = Data.from<ThreadDatum>(utxo.datum!, ThreadDatum)
    const dtm = {
        mint_count: existing_dtm.mint_count+1n,
        idx: existing_dtm.idx
    }

    const tname = projectDetails.tname + left_pad(2, (existing_dtm.mint_count+1n).toString())

    await mint(
        lucid,
        user1,
        utxo,
        projectDetails.token_policy,
        projectDetails.thread_validator,
        projectDetails.thread_policy,
        lucidLib.utils.validatorToAddress(projectDetails.meta_val),
        {
            [toUnit(token_policy_id, fromText(tname), 100)] : 1n,
            [toUnit(token_policy_id, fromText(tname), 222)] : 1n,
        },
        {
            [toUnit(token_policy_id, fromText(tname), 100)] : 1n,
        },
        dtm
    )

    if (flags.debug && emulator) {
        emulator.awaitBlock(5)
        console.log('buyer: ', await lucid.wallet.getUtxos())
        console.log('thread_addr: ', await lucid.utxosAt(
            lucidLib.utils.validatorToAddress(projectDetails.thread_validator))
        )
        console.log('meta: ', await lucid.utxosAt(
            lucidLib.utils.validatorToAddress(projectDetails.meta_val))
        )
    }
}

main()
