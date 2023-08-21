import { ensureFile } from 'https://deno.land/std/fs/mod.ts'
import {
    SpendingValidator,
    Emulator,
    Lucid,
    Data,
    UTxO,
    generateSeedPhrase,
    fromText,
    toUnit,
    Unit
} from '../../../repos/lucid/mod.ts'
import { MetaData } from './types.ts'
import { getUpdateFlags, } from './util.ts'
import keys from './keyfile.json' assert {type: 'json'}
import { Blockfrost } from 'lucid'

const lucidLib = await Lucid.new(undefined, "Custom");

async function setupChain(
    debug: boolean,
    meta_val_addr: string,
    ref_unit: Unit,
    own_tn_unit: Unit,
    dtm: MetaData
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
                address: meta_val_addr, 
                assets: { [ref_unit]: 1n }, 
                datum: Data.to<MetaData>(dtm, MetaData)
            },
            { 
                address: address1, 
                assets: { 
                    lovelace: 100_000_000n,
                    [own_tn_unit]: 1n
                },
            }
        ]);
        lucid = await Lucid.new(emulator);
    } else {
        user1 = keys.seed;
        address1 = await lucidLib.selectWalletFromSeed(user1).wallet.address();
        
        lucid = await Lucid.new(
            new Blockfrost(
                "https://cardano-preprod.blockfrost.io/api/v0",
                keys.blockfrostKey
            ), 
            "Preprod"
        );
    }

    return {lucid, user1, address1, emulator}
}

async function updateMetaData(
    lucid:Lucid,
    user_key:string,
    meta_val: SpendingValidator,
    ref_unit: Unit,
    ownership_utxo: UTxO,
    ref_utxo: UTxO,
    new_dtm: MetaData
) {
    lucid.selectWalletFromSeed(user_key)

    const meta_addr = lucidLib.utils.validatorToAddress(meta_val)

    const tx = await lucid
        .newTx()
        .collectFrom([ownership_utxo, ref_utxo], Data.void())
        .attachSpendingValidator(meta_val)
        .payToContract(
            meta_addr, 
            { inline: Data.to<MetaData>(new_dtm, MetaData)},
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

async function main() {
    const flags = getUpdateFlags() 
    const path = `./${flags.pname}.json`

    await ensureFile(path)
    const projectDetails = JSON.parse(await Deno.readTextFile(path))

    const token_policy_id = lucidLib.utils.mintingPolicyToId(projectDetails.token_policy)
    const ownership_policy_id = lucidLib.utils.mintingPolicyToId(projectDetails.ownership_policy)
    const meta_addr = lucidLib.utils.validatorToAddress(projectDetails.meta_val)

    const ref_unit = toUnit(token_policy_id, fromText(projectDetails.tname + left_pad(2, flags.tnid.toString())), 100) 
    const own_unit = toUnit(ownership_policy_id, fromText(projectDetails.oname))

    const {lucid, user1, address1, emulator} = await setupChain(
        flags.debug,
        meta_addr,
        ref_unit,
        own_unit,
        { myField: fromText("hello old datum")} 
    );

    const ref_utxo = (await lucid.utxosAt(meta_addr)).find(o => o.assets[ref_unit] == 1n);
    if (!ref_utxo) throw new Error('Ref utxo not found at meta val')

    const own_utxo = (await lucid.utxosAt(address1)).find(o => o.assets[own_unit] == 1n)
    if (!own_utxo) throw new Error('Own utxo not found at owner wallet')

    await updateMetaData(
        lucid,
        user1,
        projectDetails.meta_val,
        ref_unit,
        own_utxo,
        ref_utxo,
        { myField: fromText("hello new datum")}
    )

    if (flags.debug && emulator) {
        emulator.awaitBlock(5)
        console.log('owner: ', await lucid.wallet.getUtxos())
        console.log('meta: ', await lucid.utxosAt(
            lucidLib.utils.validatorToAddress(projectDetails.meta_val))
        )
    }
}

main()
