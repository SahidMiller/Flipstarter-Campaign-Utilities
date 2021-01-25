// Load the bitbox library.
const { BITBOX } = require('bitbox-sdk')
const { varBuf, reverseBuf } = require('./buffer')
const TransactionHelper = require('../TransactionHelper')

const bitbox = new BITBOX();
const ECSignature = require("@bitcoin-dot-com/bitcoincashjs2-lib").ECSignature;

function assembleSighashDigest(outputs, previousTransactionHash, previousTransactionOutputIndex, previousTransactionOutputValue, inputLockScript) {
  // Initialize an empty array of outpoints.
  let transactionOutpoints = [];

  // For each output in the current contract..
  for (const currentOutput in outputs) {
    // Add the output value.
    transactionOutpoints.push(outputs[currentOutput].value);

    // Add the output lockscript.
    transactionOutpoints.push(
      varBuf(outputs[currentOutput].locking_script)
    );
  }

  const emptyHash = "0000000000000000000000000000000000000000000000000000000000000000"
  const nVersion = Buffer.from("02000000", "hex");
  const hashPrevouts = Buffer.from(emptyHash, "hex");
  const hashSequence = Buffer.from(emptyHash, "hex");
  const outpoint = Buffer.concat([
    reverseBuf(previousTransactionHash),
    previousTransactionOutputIndex,
  ]);
  const scriptCode = Buffer.concat([
    Buffer.from("19", "hex"),
    inputLockScript,
  ]);
  const value = previousTransactionOutputValue;
  const nSequence = Buffer.from("FFFFFFFF", "hex");
  const hashOutputs = bitbox.Crypto.hash256(
    Buffer.concat(transactionOutpoints)
  );
  const nLocktime = Buffer.from("00000000", "hex");
  const sighashType = Buffer.from("c1000000", "hex");

  // Debug output.
  // console.log([ nVersion, hashPrevouts, hashSequence, outpoint, scriptCode, value, nSequence, hashOutputs, nLocktime, sighashType ]);

  // TODO: Verify sighash type.
  const sighashMessage = Buffer.concat([
    nVersion,
    hashPrevouts,
    hashSequence,
    outpoint,
    scriptCode,
    value,
    nSequence,
    hashOutputs,
    nLocktime,
    sighashType,
  ]);
  const sighashDigest = bitbox.Crypto.hash256(sighashMessage);

  //
  return sighashDigest;
}

module.exports = (recipients, commitment) => {
  const outputs = recipients.map(({ address, satoshis }) => {
    return TransactionHelper.addOutput(satoshis, address)
  })

  const previousTransactionHash = Buffer.from(commitment.txHash, "hex");
  const previousLockScript = Buffer.from(commitment.lockingScript, "hex")
  const previousTransactionUnlockScript = Buffer.from(commitment.unlockingScript, "hex");
  const previousTransactionOutputIndex = TransactionHelper.encodeOutputIndex(commitment.txIndex);
  const previousTransactionOutputValue = TransactionHelper.encodeOutputValue(commitment.satoshis);
  const verificationParts = TransactionHelper.parseKeyHashUnlockScript(previousTransactionUnlockScript);

  // Validate commitment signature
  const verificationMessage = assembleSighashDigest(
    outputs,
    previousTransactionHash,
    previousTransactionOutputIndex,
    previousTransactionOutputValue,
    previousLockScript
  );
  
  const verificationKey = bitbox.ECPair.fromPublicKey(verificationParts.publicKey);
  const verificationSignature = ECSignature.parseScriptSignature(verificationParts.signature).signature;
  const verificationStatus = bitbox.ECPair.verify(verificationKey, verificationMessage, verificationSignature);

  return !!verificationStatus
}