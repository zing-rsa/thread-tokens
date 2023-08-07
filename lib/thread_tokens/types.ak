use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Script}

pub type PolicyId =
  Hash<Blake2b_224, Script>

pub type ThreadDatum {
  mint_count: Int,
}

pub type ThreadPolicyInfo {
  thread_policy: PolicyId,
  token_policy: PolicyId,
  token_prefix: ByteArray,
  max_supply: Int,
}
