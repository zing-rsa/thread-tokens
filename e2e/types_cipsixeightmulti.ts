import { Data } from 'lucid'

// -----------------------------------------------------------------------
// types

export const OutRefShape = Data.Object({
    transaction_id: Data.Object({ hash: Data.Bytes()}),
    output_index: Data.Integer()
})
export type OutRef = Data.Static<typeof OutRefShape>
export const OutRef = OutRefShape as unknown as OutRef

export const ThreadPolicyParamsShape = Data.Tuple([
    OutRefShape
])
export type ThreadPolicyParams = Data.Static<typeof ThreadPolicyParamsShape>;
export const ThreadPolicyParams = ThreadPolicyParamsShape as unknown as ThreadPolicyParams

export const ThreadValidatorInfoShape = Data.Object({

  thread_policy: Data.Bytes(),
  token_policy: Data.Bytes(),
})
export type ThreadValidatorInfo = Data.Static<typeof ThreadValidatorInfoShape>;
export const ThreadValidatorInfo = ThreadValidatorInfoShape as unknown as ThreadValidatorInfo

export const ThreadValidatorParamsShape = Data.Tuple([

    ThreadValidatorInfoShape
]);
export type ThreadValidatorParams = Data.Static<typeof ThreadValidatorParamsShape>  
export const ThreadValidatorParams = ThreadValidatorParamsShape as unknown as ThreadValidatorParams

export const ThreadDatumShape = Data.Object({
    mint_count: Data.Integer(),
    idx: Data.Integer()
})
export type ThreadDatum = Data.Static<typeof ThreadDatumShape>
export const ThreadDatum = ThreadDatumShape as unknown as ThreadDatum

export const TokenPolicyInfoShape = Data.Object({
  thread_policy: Data.Bytes(),
  token_prefix: Data.Bytes(),
  token_id_leftpad: Data.Integer(),
  max_supply: Data.Integer(),
  thread_count: Data.Integer(),
  meta_val: Data.Bytes(),
  owner_policy: Data.Bytes(),
  owner_name: Data.Bytes()
})
export type TokenPolicyInfo = Data.Static<typeof TokenPolicyInfoShape>
export const TokenPolicyInfo = TokenPolicyInfoShape as unknown as TokenPolicyInfo

export const TokenPolicyParamsShape = Data.Tuple([
    TokenPolicyInfoShape
])
export type TokenPolicyParams = Data.Static<typeof TokenPolicyParamsShape>
export const TokenPolicyParams = TokenPolicyParamsShape as unknown as TokenPolicyParams

export const MetaPolicyInfoShape = Data.Object({
    ownership_policy: Data.Bytes(),
    ownership_name: Data.Bytes()
})
export type MetaPolicyInfo = Data.Static<typeof MetaPolicyInfoShape>
export const MetaPolicyInfo = MetaPolicyInfoShape as unknown as MetaPolicyInfo

export const MetaPolicyParamsShape = Data.Tuple([
    MetaPolicyInfoShape
])
export type MetaPolicyParams = Data.Static<typeof MetaPolicyParamsShape>
export const MetaPolicyParams = MetaPolicyParamsShape as unknown as MetaPolicyParams

export const ActionShape = Data.Enum([
    Data.Literal("Minting"),
    Data.Literal("Burning"),
])
export type Action = Data.Static<typeof ActionShape>
export const Action = ActionShape as unknown as Action
