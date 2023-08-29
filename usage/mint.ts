import { ensureFile } from 'https://deno.land/std/fs/mod.ts'
import {
    SpendingValidator,
    MintingPolicy,
    Emulator,
    Assets,
    Lucid,
    Data,
    UTxO,
    generateSeedPhrase,
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
import keys from './keyfile.json' assert {type: 'json'}
import { Blockfrost } from 'lucid'

const lucidLib = await Lucid.new(undefined, "Custom");

async function setupChain(
    debug: boolean,
    threadValidatorAddress: Address,
    threadUnit: Unit,
    threadDatum: ThreadDatum,
    owner_unit: Unit
) {

    let lucid; 
    let address1;
    let user1;
    let emulator;

    if (debug) {
        user1 = generateSeedPhrase();
        address1 = await lucidLib.selectWalletFromSeed(user1).wallet.address();
        
        emulator = new Emulator([
            { 
                address: threadValidatorAddress, 
                assets: { [threadUnit]: 1n }, 
                outputData: {
                    inline: Data.to<ThreadDatum>(threadDatum, ThreadDatum)
                } 
            },
            { address: address1, assets: 
                { 
                    lovelace: 100_000_000n,
                } 
            },
            { address: address1, assets: 
                { 
                    [owner_unit] : 1n
                } 
            }
        ]);
        lucid = await Lucid.new(emulator);
    } else {
        user1 = keys.seed;
        address1 = await lucidLib.selectWalletFromSeed(user1).wallet.address();
        
        lucid = await Lucid.new(new Blockfrost(
            "https://cardano-preprod.blockfrost.io/api/v0",
            keys.blockfrostKey
        ), "Preprod");
    }

    return {lucid, user1, address1, emulator}
}

async function mint(
    lucid:Lucid,
    user_key:string,
    thread:UTxO,
    owner: UTxO,
    policy:MintingPolicy,
    thread_val: SpendingValidator,
    thread_mintpolicy: MintingPolicy,
    meta_addr: string,
    assets: Assets,
    ref_asset: Assets,
    dtm: ThreadDatum,
) {
    lucid.selectWalletFromSeed(user_key);

    const thread_policy = lucidLib.utils.mintingPolicyToId(thread_mintpolicy)
    const thread_val_addr = lucidLib.utils.validatorToAddress(thread_val)

    const utxo = (await lucid.wallet.getUtxos()).find(o => o.assets['lovelace'] > 10_000_000)
    if (!utxo) throw new Error('couldnt find suitable utxo at minter address')

    const tx = await lucid
        .newTx()
        .collectFrom([utxo, thread, owner], Data.void())
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

    return txHash;
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
    const ownership_policy_id = lucidLib.utils.mintingPolicyToId(projectDetails.ownership_policy)

    const {lucid, user1, emulator, address1} = await setupChain(
        flags.debug,
        thread_val_address,
        toUnit(thread_policy, fromText("thread")),
        { mint_count: 0n, idx: 0n },
        toUnit(ownership_policy_id, fromText(projectDetails.oname))
    );

    const [thread_utxo] = await lucid.utxosAt(thread_val_address);

    const existing_dtm = Data.from<ThreadDatum>(thread_utxo.datum!, ThreadDatum)
    const dtm = {
        mint_count: existing_dtm.mint_count+1n,
        idx: existing_dtm.idx
    }

    const owner_utxo = (await lucid.utxosAt(address1)).find((o) => 
        o.assets[toUnit(ownership_policy_id, fromText(projectDetails.oname))] >= 1n
    )
    if (!owner_utxo) throw new Error('no ownership utxo found')

    const tname = projectDetails.tname + left_pad(projectDetails.leftpad, (existing_dtm.mint_count+1n).toString())

    const txHash = await mint(
        lucid,
        user1,
        thread_utxo,
        owner_utxo,
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
    } else {
        console.log('minted: ', txHash)
    }
}

main()
