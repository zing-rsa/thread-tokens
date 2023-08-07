use aiken/bytearray 

pub fn int_to_bytearray(n: Int) -> ByteArray {
  when n is {
    0 ->
      #"30"
    1 ->
      #"31"
    2 ->
      #"32"
    3 ->
      #"33"
    4 ->
      #"34"
    5 ->
      #"35"
    6 ->
      #"36"
    7 ->
      #"37"
    8 ->
      #"38"
    9 ->
      #"39"
    n ->
      bytearray.concat(int_to_bytearray(n / 10), int_to_bytearray(n % 10))
  }
}
