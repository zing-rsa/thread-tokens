use aiken/builtin.{append_bytearray}
use aiken/list
use aiken/transaction.{InlineDatum, Mint, ScriptContext}
use aiken/transaction/value.{from_minted_value, quantity_of}
use thread_tokens/types_multi.{ThreadDatum, TokenPolicyInfo}
use thread_tokens/util.{int_to_bytearray, left_pad}

validator(info: TokenPolicyInfo) {
  fn mint(rdm: Int, ctx: ScriptContext) {
    expect Mint(own_policy) = ctx.purpose

    expect Some(thread_in) =
      list.find(
        ctx.transaction.inputs,
        fn(i) { quantity_of(i.output.value, info.thread_policy, "thread") == 1 },
      )

    expect InlineDatum(thread_data) = thread_in.output.datum
    expect thread_dtm: ThreadDatum = thread_data

    let correct_id =
      rdm == info.max_supply / info.thread_count * thread_dtm.idx + thread_dtm.mint_count + 1

    let below_supply =
      thread_dtm.mint_count < info.max_supply / info.thread_count

    let token_name =
      append_bytearray(info.token_prefix, left_pad(2, int_to_bytearray(rdm)))

    let mints_one =
      quantity_of(
        from_minted_value(ctx.transaction.mint),
        own_policy,
        token_name,
      ) == 1

    mints_one && correct_id && below_supply
  }
}
//fn valid_mint(
//  mint: Value,
//  token_policy: PolicyId,
//  token_name: ByteArray,
//  mint_id: Int,
//) -> Bool {
//  let correct_token_name =
//    append_bytearray(
//      token_name,
//      left_pad(2, int_to_bytearray(mint_id)),
//    )
//
//  // make the left pad dynamic
//  let one_token = quantity_of(mint, token_policy, correct_token_name) == 1
//
//  one_token 
//}
//
//fn below_supply(out_dtm: ThreadDatum, max_supply: Int) -> Bool {
//  out_dtm.mint_count <= max_supply
//}

// --------------------------------------------------------------------------------
// testing

//test test_valid_mint() {
//  let val = from_asset("aaaa", encode_utf8(@"token01"), 1)
//  let dtm = ThreadDatum { mint_count: 0 }
//
//  valid_mint(val, "aaaa", encode_utf8(@"token"), 1, dtm)
//}
//
//test test_invalid_mint() fail {
//  let val = from_asset("aaaa", encode_utf8(@"token01"), 1)
//  let dtm = ThreadDatum { mint_count: 0 }
//  if valid_mint(val, "aaaa", encode_utf8(@"token"), 2, dtm) {
//    True
//  } else {
//    fail
//  }
//}
//
//test test_invalid_id() fail {
//  let val = from_asset("aaaa", encode_utf8(@"token02"), 1)
//  let dtm = ThreadDatum { mint_count: 0 }
//  if valid_mint(val, "aaaa", encode_utf8(@"token"), 2, dtm) {
//    True
//  } else {
//    fail
//  }
//}
//
//test test_invalid_mint_amount() fail {
//  let val = from_asset("aaaa", encode_utf8(@"token01"), 2)
//  let dtm = ThreadDatum { mint_count: 0 }
//  if valid_mint(val, "aaaa", encode_utf8(@"token"), 1, dtm) {
//    True
//  } else {
//    fail
//  }
//}
