use aiken/transaction.{OutputReference, ScriptContext, find_input}

validator(out: OutputReference) {
  fn mint(_rdm: Void, ctx: ScriptContext) {
    when find_input(ctx.transaction.inputs, out) is {
      Some(_) -> True
      None -> fail
    }
  }
}
