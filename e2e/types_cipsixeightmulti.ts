import { Data } from 'lucid'

// -----------------------------------------------------------------------
// types

export const OutRefShape = Data.Object({
    transaction_id: Data.Object({ hash: Data.Bytes()}),
    output_index: Data.Integer()
})
export type OutRef = Data.Static<typeof OutRefShape>


export const ThreadPolicyParamsShape = Data.Tuple([
    OutRefShape
])
export type ThreadPolicyParams = Data.Static<typeof ThreadPolicyParamsShape>;


export const ThreadValidatorInfoShape = Data.Object({
  thread_policy: Data.Bytes(),
  token_policy: Data.Bytes(),
})
export type ThreadValidatorInfo = Data.Static<typeof ThreadValidatorInfoShape>;


export const ThreadValidatorParamsShape = Data.Tuple([
    ThreadValidatorInfoShape
]);
export type ThreadValidatorParams = Data.Static<typeof ThreadValidatorParamsShape>  


export const ThreadDatumShape = Data.Object({
    mint_count: Data.Integer(),
    idx: Data.Integer()
})
export type ThreadDatum = Data.Static<typeof ThreadDatumShape>

export const TokenPolicyInfoShape = Data.Object({
  thread_policy: Data.Bytes(),
  token_prefix: Data.Bytes(),
  max_supply: Data.Integer(),
  thread_count: Data.Integer(),
  meta_val: Data.Bytes()
})
export type TokenPolicyInfo = Data.Static<typeof TokenPolicyInfoShape>

export const TokenPolicyParamsShape = Data.Tuple([
    TokenPolicyInfoShape
])
export type TokenPolicyParams = Data.Static<typeof TokenPolicyParamsShape>

export const MetaPolicyInfoShape = Data.Object({
    ownership_policy: Data.Bytes(),
    ownership_name: Data.Bytes()
})
export type MetaPolicyInfo = Data.Static<typeof MetaPolicyInfoShape>

export const MetaPolicyParamsShape = Data.Tuple([
    MetaPolicyInfoShape
])
export type MetaPolicyParams = Data.Static<typeof MetaPolicyParamsShape>
