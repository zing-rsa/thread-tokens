use aiken/list
use aiken/transaction.{ScriptContext}
use aiken/transaction/value.{from_asset}
use thread_tokens/types.{TokenPolicyInfo}

validator(token_policy_info: TokenPolicyInfo) {
  fn mint(_rdm: Void, ctx: ScriptContext) {
    list.any(
      ctx.transaction.inputs,
      fn(i) {
        i.output.value == from_asset(
          token_policy_info.thread_policy,
          "thread",
          1,
        )
      },
    )
  }
}
