use aiken/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Redeemer, ScriptContext,
  Spend, TransactionId, find_input, find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential, from_verification_key}
use aiken/transaction/value.{
  MintedValue, from_asset, from_lovelace, from_minted_value, quantity_of,
}
use thread_tokens/types.{PolicyId, ThreadDatum, ThreadPolicyInfo}

//------------------------------------------------------------------------------
// onchain

validator(out: OutputReference) {
  fn policy(_rdm: Redeemer, ctx: ScriptContext) {
    policy_impl(ctx.transaction.inputs, out)
  }
}

fn policy_impl(inputs: List<Input>, out: OutputReference) -> Bool {
  expect Some(input) = find_input(inputs, out)
  input.output_reference == out
}

validator(thread_policy_info: ThreadPolicyInfo) {
  fn spend(dtm: ThreadDatum, _rdm: Redeemer, ctx: ScriptContext) {
    // try use the redeemer for the id of the asset
    // then check against mintcount
    // then check asset_prefix + id = minted asset name 
    expect Spend(out_ref) = ctx.purpose

    expect Some(own_input) = find_input(ctx.transaction.inputs, out_ref)

    expect ScriptCredential(own_hash) =
      own_input.output.address.payment_credential

    expect [own_out] = find_script_outputs(ctx.transaction.outputs, own_hash)
    expect InlineDatum(dtm_data) = own_out.datum
    expect out_dtm: ThreadDatum = dtm_data

    returns_valid_thread(
      own_out,
      thread_policy_info.thread_policy,
      dtm,
      out_dtm,
    ) && below_supply(out_dtm, thread_policy_info.max_supply) && mints_one(
      ctx.transaction.mint,
      thread_policy_info.token_policy,
      thread_policy_info.token_prefix,
    )
  }
}

fn returns_valid_thread(
  out: Output,
  policy: PolicyId,
  tx_dtm: ThreadDatum,
  out_dtm: ThreadDatum,
) -> Bool {
  out.value == from_asset(policy, "thread", 1) && out_dtm.mint_count == tx_dtm.mint_count + 1
}

fn mints_one(
  mint: MintedValue,
  token_policy: PolicyId,
  token_name: ByteArray,
) -> Bool {
  quantity_of(from_minted_value(mint), token_policy, token_name) == 1
  // need to add the mintcount to the token name here
}

fn below_supply(out_dtm: ThreadDatum, max_supply: Int) -> Bool {
  out_dtm.mint_count >= max_supply
}

//------------------------------------------------------------------------------
// testing

test valid() {
  let outRef =
    OutputReference {
      transaction_id: TransactionId { hash: "aaaa" },
      output_index: 0,
    }

  let inputs =
    [
      Input {
        output_reference: OutputReference {
          transaction_id: TransactionId { hash: "aaaa" },
          output_index: 0,
        },
        output: Output {
          address: from_verification_key("ffff"),
          value: from_lovelace(1_000_000),
          datum: NoDatum,
          reference_script: None,
        },
      },
    ]

  policy_impl(inputs, outRef)
}

test invalid() fail {
  let outRef =
    OutputReference {
      transaction_id: TransactionId { hash: "bbbb" },
      output_index: 0,
    }

  let inputs =
    [
      Input {
        output_reference: OutputReference {
          transaction_id: TransactionId { hash: "aaaa" },
          output_index: 0,
        },
        output: Output {
          address: from_verification_key("ffff"),
          value: from_lovelace(1_000_000),
          datum: NoDatum,
          reference_script: None,
        },
      },
    ]

  policy_impl(inputs, outRef)
}
