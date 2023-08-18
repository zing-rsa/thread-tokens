use aiken/list
use aiken/transaction.{ScriptContext, Spend, find_input}
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value.{quantity_of, without_lovelace}
use thread_tokens/types_cipsixeight.{MetaInfo}

validator(info: MetaInfo) {
  fn spend(_dtm: Void, _rmd: Void, ctx: ScriptContext) {
    expect Spend(out_ref) = ctx.purpose
    expect Some(own_input) = find_input(ctx.transaction.inputs, out_ref)
    expect ScriptCredential(own_hash) =
      own_input.output.address.payment_credential

    expect Some(_) =
      list.find(
        ctx.transaction.inputs,
        fn(i) {
          quantity_of(
            i.output.value,
            info.ownership_policy,
            info.ownership_name,
          ) == 1
        },
      )

    expect Some(_) =
      list.find(
        ctx.transaction.outputs,
        fn(o) {
          o.address.payment_credential == ScriptCredential(own_hash) && without_lovelace(
            o.value,
          ) == without_lovelace(own_input.output.value)
        },
      )

    True
  }
}
