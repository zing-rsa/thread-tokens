use aiken/list
use aiken/transaction.{
  InlineDatum, OutputReference, Redeemer, ScriptContext, Spend, find_input,
  find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value.{from_minted_value, policies, quantity_of}
use thread_tokens/types.{ThreadDatum, ThreadValidatorInfo}

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

    expect Some(spend_input) = find_input(ctx.transaction.inputs, out_ref)
    expect ScriptCredential(own_hash) =
      spend_input.output.address.payment_credential

    expect [own_in] =
      list.filter(
        ctx.transaction.inputs,
        fn(i) {
          i.output.address.payment_credential == ScriptCredential(own_hash)
        },
      )
    expect [own_out] = find_script_outputs(ctx.transaction.outputs, own_hash)

    expect InlineDatum(dtm_data) = own_out.datum
    expect out_dtm: ThreadDatum = dtm_data

    let mint = from_minted_value(ctx.transaction.mint)

    let consumes_one_thread =
      quantity_of(own_in.output.value, info.thread_policy, "thread") == 1

    let returns_one_thread =
      quantity_of(own_out.value, info.thread_policy, "thread") == 1

    let mints_tokens = list.has(policies(mint), info.token_policy)

    let increments_count = out_dtm.mint_count == dtm.mint_count + 1

    returns_one_thread && consumes_one_thread && mints_tokens && increments_count
  }
}
