use aiken/hash.{Blake2b_224, Hash}
use aiken/transaction/credential.{Script}

type PolicyId =
  Hash<Blake2b_224, Script>

type ThreadDatum {
  mint_count: Int,
  threadIdx: Int,
  threadCount: Int,
}

type ThreadInfo {
  threadToken: PolicyId,
  tokenPolicy: PolicyId,
  tokenPrefix: ByteArray,
  maxSupply: Int,
}
