import { MintingPolicy, UTxO, applyParamsToScript, SpendingValidator } from "lucid";
import {
    ThreadValidatorParams,
    ThreadPolicyParams,
    MetaPolicyParams,
    TokenPolicyParams,
    MetaPolicyInfo,
    ThreadValidatorInfo,
    TokenPolicyInfo,
    UpdateFlags,
    MintFlags,
    OutRef,
} from './types.ts'
import { parse } from 'https://deno.land/std/flags/mod.ts'
import plutus from '../plutus.json' assert {type: "json"}

const threadPolicyCode = plutus.validators.find(v => v.title == "thread_cipsixeightmulti.mint")
const threadValidatorCode = plutus.validators.find(v => v.title == "thread_cipsixeightmulti.spend")
const tokenPolicyCode = plutus.validators.find(v => v.title == "token_cipsixeightmulti.mint")
const metaVal = plutus.validators.find(v => v.title == "meta.spend")
const ownershipCode = plutus.validators.find(v => v.title == "ownership.mint")

// ------------------------------------------------------------------------
// policy compilation

export function getThreadPolicy(utxo: UTxO): MintingPolicy {

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

export function getThreadValidator(info: ThreadValidatorInfo): SpendingValidator {

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

export function getTokenPolicy(info: TokenPolicyInfo): MintingPolicy {

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

export function getMetaVal(info: MetaPolicyInfo): SpendingValidator {

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

export function getOwnershipPolicy(utxo: UTxO): MintingPolicy {

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

export function getFlags(): DeployFlags {
    const args = parse(Deno.args, {
        string: ["pname", "tname", "oname", "sup", "threads" ],
        boolean: ["debug"],
        default: {debug: true}
    })

    if (!args.pname || !args.tname || !args.sup || !args.oname || !args.threads)
        throw new Error('Missing args')

    return {
        pname: args.pname,
        tname: args.tname,
        oname: args.oname,
        sup: parseInt(args.sup), 
        threads: parseInt(args.threads),
        debug: args.debug
    }
}

export function getMintFlags(): MintFlags {
    const args = parse(Deno.args, {
        string: ["pname", "count"],
        boolean: ["debug"],
        default: {debug: true}
    })

    if (!args.pname || !args.count)
        throw new Error('Missing args')

    return {
       pname: args.pname, 
       count: parseInt(args.count),
       debug: args.debug
    }
}

export function getUpdateFlags(): UpdateFlags {
    const args = parse(Deno.args, {
        string: ["pname", "tnid"],
        boolean: ["debug"],
        default: {debug: true}
    })

    if (!args.pname || !args.count || !args.tnid)
        throw new Error('Missing args')

    return {
       pname: args.pname, 
       tnid: parseInt(args.tnid),
       debug: args.debug
    }
}
