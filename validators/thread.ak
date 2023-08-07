use aiken/transaction.{
    OutputReference,
    Redeemer,
    ScriptContext,
    Input,
    find_input, 
    TransactionId, 
    Output,
    NoDatum
}
use aiken/transaction/credential.{from_verification_key}
use aiken/transaction/value.{from_lovelace}

//------------------------------------------------------------------------------
// onchain

validator(out: OutputReference ) {
    fn policy(_rdm: Redeemer, ctx: ScriptContext) {
        validate(ctx.transaction.inputs, out)
    }
}

fn validate(inputs: List<Input>, out: OutputReference) -> Bool {
        expect Some(input) = find_input(inputs, out)
        input.output_reference == out
}

//------------------------------------------------------------------------------
// testing

test valid() {
    
    let outRef = OutputReference {
        transaction_id: TransactionId { hash: "aaaa" } ,
        output_index: 0
    }

    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "aaaa" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("ffff"),
                value: from_lovelace(1_000_000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]

    validate(inputs, outRef) 
}

!test invalid() {
    
    let outRef = OutputReference {
        transaction_id: TransactionId { hash: "bbbb" } ,
        output_index: 0
    }

    let inputs = [
          Input { 
            output_reference: OutputReference {
                transaction_id: TransactionId { hash: "aaaa" } ,
                output_index: 0
            },
            output: Output {
                address: from_verification_key("ffff"),
                value: from_lovelace(1_000_000),
                datum: NoDatum,
                reference_script: None
            }
        }
    ]

    validate(inputs, outRef) 
}
