use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Script}

pub type PolicyId =
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
  max_supply: Int,
  thread_count: Int,
}
