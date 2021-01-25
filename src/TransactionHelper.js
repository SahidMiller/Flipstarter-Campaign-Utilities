const { BITBOX } = require('bitbox-sdk')
const bitbox = new BITBOX();

const dustLimit = 546
const maxLimit = 2099999997690000

module.exports = class TransactionBuilder {
    /**
   * Constructor that takes parameters necessary to construct the assurance contract object.
   *
   * @param assuranceStorage   an object with the following storage methods: clear(), getItem(key), setItem(key, value), removeItem(key).
   */
  constructor() {
  }

  /**
   * Adds an output to the assurance contract.
   *
   * @param satoshis    integer number of satoshis to send to the address.
   * @param address     cashaddr encoded output address to send satoshis to.
   */
  static addOutput(satoshis, address) {
    // Check if the provided address is properly encoded.
    if (!bitbox.Address.isCashAddress(address)) {
      throw `Cannot add output, provided address '${address}' does not use the valid CashAddr encoding.`;
    }

    // Check if the provided satoshis is of the correct type.
    if (isNaN(satoshis)) {
      throw `Cannot add output, provided satoshis '${satoshis}' is not a number.`;
    }

    // Check if the provided satoshis is an integer.
    if (!Number.isInteger(satoshis)) {
      throw `Cannot add output, provided satoshis '${satoshis}' is not an integer.`;
    }

    // Check if the provided satoshis is a positive number.
    if (satoshis < 0) {
      throw `Cannot add output, provided satoshis '${satoshis}' is negative.`;
    }

    // Check if the provided satoshis is large enough to be accepted.
    if (satoshis < dustLimit) {
      throw `Cannot add output, provided satoshis '${satoshis}' is smaller than the dust limit.`;
    }

    // Check if the provided satoshis is too large to be accepted.
    if (satoshis > maxLimit) {
      throw `Cannot add output, provided satoshis '${satoshis}' is larger than the max limit.`;
    }

    // Derive the locking script from the address.
    const locking_script = TransactionBuilder.getLockscriptFromAddress(address);

    // Structure the output
    return {
      value: TransactionBuilder.encodeOutputValue(satoshis),
      locking_script: locking_script,
    };
  }

  /**
   * Encodes a number of satoshis to be used as part of an output structure in a raw transaction.
   *
   * @param satoshis   integer number of satoshis to send.
   *
   * @returns a buffer with raw bytes holding the encoded number.
   */
  static encodeOutputValue(satoshis) {
    // Check if the provided satoshis is of the correct type.
    if (isNaN(satoshis)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is not a number.`;
    }

    // Check if the provided satoshis is an integer.
    if (!Number.isInteger(satoshis)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is not an integer.`;
    }

    // Check if the provided satoshis is a positive number.
    if (satoshis < 0) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is negative.`;
    }

    // Check if the provided satoshis is within our accepted number range.
    if (satoshis > Math.pow(2, 53)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is larger than javacripts 53bit limit.`;
    }

    // Allocate 8 bytes.
    let value = Buffer.alloc(8);

    // Split the number into high and low bits.
    let highValue = Math.floor(satoshis / Math.pow(2, 32));
    let lowValue = satoshis % Math.pow(2, 32);

    // Write the satoshi number to the buffer in 64bit.
    value.writeUInt32LE(highValue, 4);
    value.writeUInt32LE(lowValue, 0);

    // Return the encoded value.
    return value;
  }

  /**
   *
   */
  static decodeOutputValue(value) {
    // TODO: Properly validate and error check.

    // Parhse the high and low value sets.
    let highValue = value.readUInt32LE(4);
    let lowValue = value.readUInt32LE(0);

    // Return the decoded value.
    return highValue * Math.pow(2, 32) + lowValue;
  }

  static getLockscriptFromAddress(address) {
    // Check if the provided address is properly encoded.
    if (!bitbox.Address.isCashAddress(address)) {
      // Return false to indicate that we only accept cashaddr encoding.
      return false;
    }
  
    // Derive the address hash.
    const hash160 = Buffer.from(bitbox.Address.cashToHash160(address), "hex");
  
    // Detect address type.
    const type = bitbox.Address.detectAddressType(address);
  
    // If the type is a public key hash..
    if (type === "p2pkh") {
      // Return a P2PKH lockscript: [opDup, opHash160, pushHash, scriptHash, opEqualVerify, opCheckSig]
      return Buffer.concat([
        Buffer.from("76a914", "hex"),
        hash160,
        Buffer.from("88ac", "hex"),
      ]);
    }
    // If the type is a script hash..
    else if (type === "p2sh") {
      // Return a P2SH lockscript: [opHash160, pushHash, scriptHash, opEqual]
      return Buffer.concat([
        Buffer.from("a914", "hex"),
        hash160,
        Buffer.from("87", "hex"),
      ]);
    } else {
      // Return false to indicate that we only accept P2PKH or P2SH types.
      return false;
    }
  }

  static parseKeyHashUnlockScript(unlockScript) {
    // The signature is the first pushed item, with a varying length depending on signature type.
    const signature = unlockScript.slice(1, -34);

    // The public key is the last pushed item of 33 bytes.
    const publicKey = unlockScript.slice(-33);

    // Return the parsed unlock script.
    return { publicKey: publicKey, signature: signature };
  }

  static encodeOutputIndex(index) {
    let outputIndex = Buffer.alloc(4);

    outputIndex.writeUInt32LE(index);

    return outputIndex;
  }
}