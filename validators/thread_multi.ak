use aiken/list
use aiken/transaction.{
  InlineDatum, OutputReference, Redeemer, ScriptContext, Spend, find_input,
  find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value.{from_minted_value, policies, quantity_of}
use thread_tokens/types_multi.{ThreadDatum, ThreadValidatorInfo}

//------------------------------------------------------------------------------
// onchain

validator(out: OutputReference) {
  fn mint(_rdm: Redeemer, ctx: ScriptContext) {
    when find_input(ctx.transaction.inputs, out) is {
      Some(_) -> True
      None -> fail
    }
  }
}

validator(info: ThreadValidatorInfo) {
  fn spend(dtm: ThreadDatum, _rdm: Void, ctx: ScriptContext) {
    expect Spend(out_ref) = ctx.purpose

    expect Some(own_input) = find_input(ctx.transaction.inputs, out_ref)
    expect ScriptCredential(own_hash) =
      own_input.output.address.payment_credential
    expect [own_out] = find_script_outputs(ctx.transaction.outputs, own_hash)

    expect InlineDatum(dtm_data) = own_out.datum
    expect out_dtm: ThreadDatum = dtm_data

    let mint = from_minted_value(ctx.transaction.mint)

    let returns_thread =
      quantity_of(own_out.value, info.thread_policy, "thread") == 1

    let mints_tokens = list.has(policies(mint), info.token_policy)

    let increments_count = out_dtm.mint_count == dtm.mint_count + 1

    let maintains_idx = out_dtm.idx == dtm.idx

    returns_thread && mints_tokens && increments_count && maintains_idx
  }
}
//------------------------------------------------------------------------------
// contract testing

//------------------------------------------------------------------------------
// unit testing

//test test_valid_thread() {
//  let val = from_asset("aaaa", "thread", 1)
//  let tx_dtm = ThreadDatum { mint_count: 0 }
//  let out_dtm = ThreadDatum { mint_count: 1 }
//
//  returns_valid_thread(val, "aaaa", tx_dtm, out_dtm)
//}
//
//test test_invalid_thread() fail {
//  let val = from_asset("aaaa", "thread", 1)
//  let tx_dtm = ThreadDatum { mint_count: 0 }
//  let out_dtm = ThreadDatum { mint_count: 0 }
//
//  if returns_valid_thread(val, "aaaa", tx_dtm, out_dtm) {
//    True
//  } else {
//    fail
//  }
//}
