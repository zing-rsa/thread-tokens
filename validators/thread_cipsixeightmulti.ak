use aiken/list
use aiken/transaction.{
  InlineDatum, OutputReference, Redeemer, ScriptContext, Spend, find_input,
  find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value.{flatten, from_minted_value, quantity_of}
use thread_tokens/types_cipsixeight.{ThreadDatum, ThreadValidatorInfo}

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

    expect Some(spent_input) = find_input(ctx.transaction.inputs, out_ref)
    expect ScriptCredential(own_hash) =
      spent_input.output.address.payment_credential

    expect [own_out] = find_script_outputs(ctx.transaction.outputs, own_hash)
    expect [own_in] =
      list.filter(
        ctx.transaction.inputs,
        fn(i) {
          i.output.address.payment_credential == ScriptCredential(own_hash)
        },
      )

    expect InlineDatum(dtm_data) = own_out.datum
    expect out_dtm: ThreadDatum = dtm_data

    let mint = from_minted_value(ctx.transaction.mint)

    let consumes_one_thread =
      quantity_of(own_in.output.value, info.thread_policy, "thread") == 1

    let returns_one_thread =
      quantity_of(own_out.value, info.thread_policy, "thread") == 1

    let mints_tokens = {
      expect [(r_pol, _, r_count), (u_pol, _, u_count)] = flatten(mint)
      r_pol == info.token_policy && u_pol == info.token_policy && r_count == 1 && u_count == 1
    }

    let increments_count = out_dtm.mint_count == dtm.mint_count + 1

    mints_tokens && consumes_one_thread && returns_one_thread && increments_count
  }
}
