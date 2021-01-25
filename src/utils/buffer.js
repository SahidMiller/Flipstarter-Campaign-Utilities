/**
 * Helper function that takes an integer and encodes it as a buffer according to
 * https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
 *
 * @param number   an integer to encode in the varInt format.
 *
 * @returns a Buffer with the integer encoded as a varInt.
 */
function varInt(number) {
  // Declare storage for the results.
  let result;

  // If the number should be encoded in 1 byte..
  if (number < 0xfd) {
    result = Buffer.alloc(1);
    result.writeUInt8(number);
  }
  // If the number should be encoded in 3 bytes..
  else if (number < 0xffff) {
    result = Buffer.alloc(3);
    result.writeUInt8(0xfd);
    result.writeUInt16LE(number, 1);
  }
  // If the number should be encoded in 5 bytes..
  else if (number < 0xffffffff) {
    result = Buffer.alloc(5);
    result.writeUInt8(0xfe);
    result.writeUInt32LE(number, 1);
  }
  // If the number should be encoded in 9 bytes..
  else {
    result = Buffer.alloc(9);
    result.writeUInt8(0xff);
    result.writeBigUInt64LE(BigInt(number), 1);
  }

  // Return the variable integer buffer.
  return result;
}

/**
 * Helper function that takes a buffer and encodes it according to
 * https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_string
 *
 * @param input   a buffer to encode in the varBuf format.
 *
 * @returns a Buffer with the content encoded as a varBuf.
 */
function varBuf(input) {
  let prependLength = varInt(input.length);
  let result = Buffer.concat([prependLength, input]);

  // Return the variable buffer encoded data.
  return result;
}

/**
 * Reverses a Buffers content
 *
 * @param source   the Buffer to reverse
 *
 * @returns a new Buffer with the contents reversed.
 */
function reverseBuf(source) {
  // Allocate space for the reversed buffer.
  let reversed = Buffer.allocUnsafe(source.length);

  // Iterate over half of the buffers length, rounded up..
  for (
    let lowIndex = 0, highIndex = source.length - 1;
    lowIndex <= highIndex;
    lowIndex += 1, highIndex -= 1
  ) {
    // .. and swap each position from the beggining to the end.
    reversed[lowIndex] = source[highIndex];
    reversed[highIndex] = source[lowIndex];
  }

  // Return the reversed buffer.
  return reversed;
}

module.exports = { varBuf, varInt, reverseBuf }