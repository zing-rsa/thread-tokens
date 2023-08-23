use aiken/builtin
use aiken/bytearray

pub fn int_to_bytearray(n: Int) -> ByteArray {
  when n is {
    0 -> #"30"
    1 -> #"31"
    2 -> #"32"
    3 -> #"33"
    4 -> #"34"
    5 -> #"35"
    6 -> #"36"
    7 -> #"37"
    8 -> #"38"
    9 -> #"39"
    n -> bytearray.concat(int_to_bytearray(n / 10), int_to_bytearray(n % 10))
  }
}

pub fn left_pad(size: Int, bytes: ByteArray) {
  if builtin.length_of_bytearray(bytes) >= size {
    bytes
  } else {
    left_pad(size, builtin.append_bytearray(#"30", bytes))
  }
}

//--------------------------------------------------------------------------------------------
// testing

// int_to_bytestring
test one() {
  int_to_bytearray(1) == builtin.encode_utf8(@"1")
}

test ten() {
  int_to_bytearray(10) == builtin.encode_utf8(@"10")
}

test twofortytwo() {
  int_to_bytearray(242) == builtin.encode_utf8(@"242")
}

test big() {
  int_to_bytearray(1486) == builtin.encode_utf8(@"1486")
}

//left_pad
test padone() {
  builtin.encode_utf8(@"01") == left_pad(2, builtin.encode_utf8(@"1"))
}

test padfour() {
  builtin.encode_utf8(@"0001") == left_pad(4, builtin.encode_utf8(@"1"))
}

test padten() {
  builtin.encode_utf8(@"0000000001") == left_pad(10, builtin.encode_utf8(@"1"))
}

test padTooLittle() {
  builtin.encode_utf8(@"120") == left_pad(2, builtin.encode_utf8(@"120"))
}
