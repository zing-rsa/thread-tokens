import {
    Lucid,
    Emulator,
    SpendingValidator,
    PrivateKey,
    Data,
    Address,
    UTxO,
    generatePrivateKey,
    applyParamsToScript
} from 'lucid'
import plutus from '../plutus.json' assert {type: "json"}

const lucidLib = await Lucid.new(undefined, "Custom");

const threadPolicyCode = plutus.validators.find(v => v.title == "thread.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token.mint")

//if (!threadValidatorCode || !threadPolicyCode || !tokenPolicyCode)
//    throw new Error('Compiled validator not found'); 

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



const Datum = Data.Object({
//
}) 
type Datum = Data.Static<typeof Datum>;


// ------------------------------------------------------------------------
// policy compilation

function getThreadPolicy(utxo: UTxO) {

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

function getThreadValidator(info: ThreadPolicyInfo) {

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

function getTokenPolicy(info: TokenPolicyInfo) {

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
// help functions


async function lock(lucid: Lucid, userKey: PrivateKey, dtm: Datum, scriptAddr: Address) {
    lucid.selectWalletFromPrivateKey(userKey);

    const tx = await lucid
        .newTx()
        //.payToContract(scriptAddr, { inline: Data.to<Datum>(dtm, Datum)}, { lovelace: 1000000n })
        .complete()

    const txSigned = await tx.sign().complete()
    const txHash = await txSigned.submit()

    return txHash;
}

// create spend(lucid, user, )
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


async function run(testParams: any) {

    const user1 = generatePrivateKey();
    const address1 = await lucidLib.selectWalletFromPrivateKey(user1).wallet.address();
    console.log('address1', address1)

    const user2 = generatePrivateKey();
    const address2 = await lucidLib.selectWalletFromPrivateKey(user2).wallet.address();
    console.log('address2', address2)

//    const scriptAddress = lucidLib.utils.validatorToAddress(validator);

    const emulator = new Emulator([
        { address: address1, assets: { lovelace: 10000000n }}, 
        { address: address2, assets: { lovelace: 10000000n }},
    ]);
    const lucid = await Lucid.new(emulator);

//    const dtm = {
//        
//    }
//
//    const lockTx = await lock(lucid, user1, dtm, scriptAddress);
//    console.log('locked: ', lockTx)
//
//    const utxoToSpend = (await lucid.utxosAt(scriptAddress))
//        .find(u => u.datum == Data.to<Datum>(dtm, Datum));
//
//    if (!utxoToSpend) throw new Error("Expected Utxos!");
//    console.log('utxo: ', utxoToSpend);
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

