import { ensureFile } from 'https://deno.land/std/fs/mod.ts'
import {
    MintingPolicy,
    Emulator,
    Address,
    Lucid,
    Data,
    fromText,
    toUnit,
    generateSeedPhrase,
Blockfrost
} from 'lucid'
import {
    ThreadValidatorInfo,
    TokenPolicyInfo,
    ThreadDatum,
} from './types.ts'
import {
    getThreadValidator,
    getOwnershipPolicy,
    getThreadPolicy,
    getDeployFlags,
    getTokenPolicy,
    getMetaVal,
} from './util.ts'
import keys from './keyfile.json' assert {type: 'json'}

const lucidLib = await Lucid.new(undefined, "Custom");

async function deployWithOwnership(
    lucid:Lucid,
    user_key:string,
    utxo_txhash: string,
    utxo_idx: number,
    thread_policy:MintingPolicy,
    thread_count:number,
    ownership_policy: MintingPolicy,
    ownership_name: string,
    thread_val_addr:Address,
) {
    lucid.selectWalletFromSeed(user_key);

    const ownership_policy_id = lucidLib.utils.mintingPolicyToId(ownership_policy)
    const thread_policy_id = lucidLib.utils.mintingPolicyToId(thread_policy)

    const utxo = (await lucid.wallet.getUtxos()).find(o => o.txHash == utxo_txhash && o.outputIndex == utxo_idx)

    if (!utxo) throw new Error("Couldn't find expected utxo at owner address")

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
            thread_val_addr, 
            { 
                inline: Data.to<ThreadDatum>({
                    mint_count: 0n,
                    idx: BigInt(i)
                }, ThreadDatum)
            }, 
            {[toUnit(thread_policy_id, fromText('thread'))] : 1n})
    }

    const tx = await txBuilder.complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

async function setupChain(
    debug: boolean
) {
    let lucid; 
    let address1;
    let user1;
    let emulator;

    if (debug) {
        user1 = generateSeedPhrase();
        address1 = await lucidLib.selectWalletFromSeed(user1).wallet.address();
        
        emulator = new Emulator([
            { address: address1, assets: { lovelace: 100_000_000n }},
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

async function setupContracts(
    THREAD_COUNT: number,
    MAX_SUPPLY: number,
    OWNERSHIP_NAME: string,
    TOKEN_NAME: string,
    ID_LEFTPAD: number,
    lucid: Lucid,
    user_key: string,
) {
    lucid.selectWalletFromSeed(user_key)

    const addr1_utxo = (await lucid.wallet.getUtxos()).find((o) => o.assets['lovelace'] > 10_000_000)

    if (!addr1_utxo) throw new Error('Suitable utxo not found')

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
        token_id_leftpad: BigInt(ID_LEFTPAD),
        max_supply: BigInt(MAX_SUPPLY),
        thread_count: BigInt(THREAD_COUNT),
        meta_val: meta_val_hash
    }
    const token_policy = getTokenPolicy(token_policy_info)
    const token_policy_id = lucidLib.utils.mintingPolicyToId(token_policy)
    
    const thread_val_info: ThreadValidatorInfo = {
        token_policy: token_policy_id,
        thread_policy: thread_policy_id,
    } 
    const thread_validator = getThreadValidator(thread_val_info)

    return {
        thread_policy,
        thread_validator,
        token_policy,
        meta_val,
        ownership_policy,
        utxo_txhash: addr1_utxo.txHash,
        utxo_idx: addr1_utxo.outputIndex,
        leftpad: ID_LEFTPAD
    }
}

async function main() {
    const flags = getDeployFlags() 
    const path = `./${flags.pname}.json`

    const {lucid, user1, emulator} = await setupChain(flags.debug);

    const deployDetails = await setupContracts(
      flags.threads,
      flags.sup,
      flags.oname,
      flags.tname,
      flags.leftpad,
      lucid,
      user1,
    ) 

    await ensureFile(path)
    await Deno.writeTextFile(path, JSON.stringify({...flags, ...deployDetails}, null, 4))

    const deployTx = await deployWithOwnership(
        lucid,
        user1,
        deployDetails.utxo_txhash,
        deployDetails.utxo_idx,
        deployDetails.thread_policy,
        flags.threads,
        deployDetails.ownership_policy,
        flags.oname,
        lucidLib.utils.validatorToAddress(deployDetails.thread_validator)
    )
    console.log('deployed: ', deployTx)

    if (emulator) {
        emulator.awaitBlock(5)
        console.log('owner: ', await lucid.wallet.getUtxos())
        console.log('thread_addr: ', await lucid.utxosAt(
            lucidLib.utils.validatorToAddress(deployDetails.thread_validator))
        )
    }
}

main()



