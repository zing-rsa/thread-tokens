use aiken/builtin.{append_bytearray}
use aiken/list
use aiken/transaction.{InlineDatum, Mint, ScriptContext}
use aiken/transaction/value.{from_minted_value, quantity_of}
use thread_tokens/types.{ThreadDatum, TokenPolicyInfo}
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

    let correct_id = rdm == thread_dtm.mint_count + 1

    let token_name =
      append_bytearray(info.token_prefix, left_pad(2, int_to_bytearray(rdm)))

    let mints_one =
      quantity_of(
        from_minted_value(ctx.transaction.mint),
        own_policy,
        token_name,
      ) == 1

    let below_supply = rdm <= info.max_supply

    mints_one && correct_id && below_supply
  }
}
