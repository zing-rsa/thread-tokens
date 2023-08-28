use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Script}

pub type PolicyId =
  Hash<Blake2b_224, Script>

pub type ValidatorHash =
  Hash<Blake2b_224, Script>

pub type ThreadDatum {
  mint_count: Int,
  idx: Int,
}

pub type ThreadValidatorInfo {
  thread_policy: PolicyId,
  token_policy: PolicyId,
}

pub type TokenPolicyInfo {
  thread_policy: PolicyId,
  token_prefix: ByteArray,
  token_id_leftpad: Int,
  max_supply: Int,
  thread_count: Int,
  meta_val: ValidatorHash,
  owner_policy: PolicyId,
  owner_name: ByteArray,
}

pub type MetaInfo {
  ownership_policy: PolicyId,
  ownership_name: ByteArray,
}
