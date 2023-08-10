use aiken/list
use aiken/transaction.{ScriptContext}
use aiken/transaction/value.{quantity_of}
use thread_tokens/types.{TokenPolicyInfo}

validator(token_policy_info: TokenPolicyInfo) {
  fn mint(_rdm: Void, ctx: ScriptContext) {
    list.any(
      ctx.transaction.inputs,
      fn(i) {
        quantity_of(i.output.value, token_policy_info.thread_policy, "thread") == 1
      },
    )
  }
}
