use aiken/builtin.{append_bytearray, encode_utf8}
use aiken/list
use aiken/transaction.{
  InlineDatum, OutputReference, Redeemer, ScriptContext, Spend, find_input,
  find_script_outputs,
}
use aiken/transaction/credential.{ScriptCredential}
use aiken/transaction/value.{Value, from_asset, from_minted_value, quantity_of}
use thread_tokens/types.{PolicyId, ThreadDatum, ThreadPolicyInfo}
use thread_tokens/util

//------------------------------------------------------------------------------
// onchain

validator(out: OutputReference) {
  fn mint(_rdm: Redeemer, ctx: ScriptContext) {
    expect Some(input) = find_input(ctx.transaction.inputs, out)
    input.output_reference == out
  }
}

validator(thread_policy_info: ThreadPolicyInfo) {
  fn spend(dtm: ThreadDatum, rdm: Int, ctx: ScriptContext) {
    expect Spend(out_ref) = ctx.purpose

    expect Some(own_input) = find_input(ctx.transaction.inputs, out_ref)
    expect ScriptCredential(own_hash) =
      own_input.output.address.payment_credential
    expect [own_out] = find_script_outputs(ctx.transaction.outputs, own_hash)

    expect InlineDatum(dtm_data) = own_out.datum
    expect out_dtm: ThreadDatum = dtm_data

    list.and(
      [
        below_supply(out_dtm, thread_policy_info.max_supply),
        returns_valid_thread(
          own_out.value,
          thread_policy_info.thread_policy,
          dtm,
          out_dtm,
        ),
        valid_mint(
          from_minted_value(ctx.transaction.mint),
          thread_policy_info.token_policy,
          thread_policy_info.token_prefix,
          rdm,
          dtm,
        ),
      ],
    )
  }
}

fn returns_valid_thread(
  val: Value,
  policy: PolicyId,
  tx_dtm: ThreadDatum,
  out_dtm: ThreadDatum,
) -> Bool {
  let returns_thread = val == from_asset(policy, "thread", 1)
  let increments_count = out_dtm.mint_count == tx_dtm.mint_count + 1

  returns_thread && increments_count
}

fn valid_mint(
  mint: Value,
  token_policy: PolicyId,
  token_name: ByteArray,
  mint_id: Int,
  tx_dtm: ThreadDatum,
) -> Bool {
  let correct_token_name =
    append_bytearray(
      token_name,
      util.left_pad(4, util.int_to_bytearray(mint_id)),
    )

  let one_token = quantity_of(mint, token_policy, correct_token_name) == 1
  let correct_id = tx_dtm.mint_count + 1 == mint_id

  one_token && correct_id
}

fn below_supply(out_dtm: ThreadDatum, max_supply: Int) -> Bool {
  out_dtm.mint_count >= max_supply
}

//------------------------------------------------------------------------------
// contract testing

//------------------------------------------------------------------------------
// unit testing

test test_valid_mint() {
  let val = from_asset("aaaa", encode_utf8(@"token0001"), 1)
  let dtm = ThreadDatum { mint_count: 0 }

  valid_mint(val, "aaaa", encode_utf8(@"token"), 1, dtm)
}

test test_invalid_mint() fail {
  let val = from_asset("aaaa", encode_utf8(@"token0001"), 1)
  let dtm = ThreadDatum { mint_count: 0 }
  if valid_mint(val, "aaaa", encode_utf8(@"token"), 2, dtm) {
    True
  } else {
    fail
  }
}

test test_invalid_id() fail {
  let val = from_asset("aaaa", encode_utf8(@"token0002"), 1)
  let dtm = ThreadDatum { mint_count: 0 }
  if valid_mint(val, "aaaa", encode_utf8(@"token"), 2, dtm) {
    True
  } else {
    fail
  }
}

test test_invalid_mint_amount() fail {
  let val = from_asset("aaaa", encode_utf8(@"token0001"), 2)
  let dtm = ThreadDatum { mint_count: 0 }
  if valid_mint(val, "aaaa", encode_utf8(@"token"), 1, dtm) {
    True
  } else {
    fail
  }
}

test test_valid_thread() {
  let val = from_asset("aaaa", "thread", 1)
  let tx_dtm = ThreadDatum { mint_count: 0 }
  let out_dtm = ThreadDatum { mint_count: 1 }

  returns_valid_thread(val, "aaaa", tx_dtm, out_dtm)
}

test test_invalid_thread() fail {
  let val = from_asset("aaaa", "thread", 1)
  let tx_dtm = ThreadDatum { mint_count: 0 }
  let out_dtm = ThreadDatum { mint_count: 0 }

  if returns_valid_thread(val, "aaaa", tx_dtm, out_dtm) {
    True
  } else {
    fail
  }
}
