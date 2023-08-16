use aiken/transaction.{ScriptContext}

validator {
  fn spend(_dtm: Void, _rmd: Void, _ctx: ScriptContext) {
    False
  }
}
