import {Lucid} from 'lucid'

import keys from './keyfile.json' assert {type: 'json'}

const l = await Lucid.new(undefined, "Preprod")

l.selectWalletFromSeed(keys.seed)

console.log(await l.wallet.address())

