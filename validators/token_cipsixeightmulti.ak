use aiken/builtin.{append_bytearray}
use aiken/bytearray.{concat}
use aiken/list
use aiken/transaction.{InlineDatum, Mint, ScriptContext}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value.{flatten, from_minted_value, quantity_of}
use constants
use thread_tokens/types_cipsixeight.{ThreadDatum, TokenPolicyInfo}
use thread_tokens/util.{int_to_bytearray, left_pad}

type Action {
  Minting
  Burning
}

validator(info: TokenPolicyInfo) {
  fn mint(action: Action, ctx: ScriptContext) {
    expect Mint(own_policy) = ctx.purpose

    when action is {
      Minting -> {
        expect Some(thread_in) =
          list.find(
            ctx.transaction.inputs,
            fn(i) {
              quantity_of(i.output.value, info.thread_policy, "thread") == 1
            },
          )

        expect InlineDatum(thread_data) = thread_in.output.datum
        expect thread_dtm: ThreadDatum = thread_data

        expect [
          (ref_policy, ref_name, ref_qty),
          (usert_policy, usert_name, usert_qty),
        ] = flatten(from_minted_value(ctx.transaction.mint))

        expect Some(_pays_ref_to_meta) =
          list.find(
            ctx.transaction.outputs,
            fn(o) {
              quantity_of(o.value, ref_policy, ref_name) == 1 && o.address == Address {
                payment_credential: ScriptCredential(info.meta_val),
                stake_credential: None,
              }
            },
          )

        expect Some(_owner_signed) =
          list.find(
            ctx.transaction.inputs,
            fn(i) {
              quantity_of(i.output.value, info.owner_policy, info.owner_name) >= 1
            },
          )

        let id =
          info.max_supply / info.thread_count * thread_dtm.idx + thread_dtm.mint_count + 1

        let below_supply =
          thread_dtm.mint_count < info.max_supply / info.thread_count

        let token_name =
          append_bytearray(
            info.token_prefix,
            left_pad(info.token_id_leftpad, int_to_bytearray(id)),
          )

        let ref_name_correct =
          ref_name == concat(constants.label100, token_name)
        let usert_name_correct =
          usert_name == concat(constants.label222, token_name)

        let policies_match =
          own_policy == usert_policy && own_policy == ref_policy

        let single_mint = usert_qty == 1 && ref_qty == 1

        below_supply && ref_name_correct && usert_name_correct && policies_match && single_mint
      }
      Burning -> {
        expect [(_, _, count)] =
          flatten(from_minted_value(ctx.transaction.mint))
        count < 0
      }
    }
  }
}
