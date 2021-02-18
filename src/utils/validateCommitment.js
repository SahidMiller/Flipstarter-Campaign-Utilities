const { BITBOX } = require("bitbox-sdk")
const moment = require("moment")

const FlipstarterErrors = require('../errors')

const { reverseBuf } = require('./buffer')
const calculateMinerFee = require('./calculateFlipstarterMinerFee')
const inputPercentModifier = require('./calculateFlipstarterFloor').falling
const validateCommitmentSignature = require('./validateCommitmentSignature')
const validateCommitmentUtxo = require("./validateCommitmentUtxo")

const bitbox = new BITBOX();

const SATS_PER_BCH = 100000000;

module.exports = async function validateCommitment(electrum, recipients, committedSatoshis, commitmentCount, commitmentData) {

  if (!commitmentData) {
    throw new FlipstarterErrors.ContributionVerificationError("Commitment is required")
  }

  if (!commitmentData.txHash) {
    throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'txHash' property")
  } 

  if (!Number.isInteger(commitmentData.txIndex)) {
    throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'txIndex' property")
  }

  if (!commitmentData.unlockingScript) {
    throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'unlockingScript' property")
  }

  if (!commitmentData.seqNum) {
    throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'seqNum' property")
  }

  const commitment = await getCommitmentInfoFromInput(electrum, commitmentData)
  const requestedSatoshis = recipients.reduce((sum, { satoshis }) => sum += satoshis, 0)

  if (!commitment) {
    // Send an "NOT FOUND" signal back to the client.
    // TODO God willing: wait around a bit
    throw new FlipstarterErrors.TransactionNotFoundError(commitmentData.txHash)
  }

  // Verify that we can find the UTXO.
  const inputUTXOs = await electrum.request("blockchain.scripthash.listunspent", commitment.scriptHash);
  const validCommitment = inputUTXOs && inputUTXOs.length && !!inputUTXOs.find((utxo) => {
    return utxo.tx_hash === commitment.txHash && utxo.tx_pos === commitment.txIndex
  })

  if (!validCommitment) {
    // Send an "NOT FOUND" signal back to the client.
    throw new FlipstarterErrors.UtxoNotFoundError(commitment.txHash)
  }
  
  if (!validateCommitmentSignature(recipients, commitment)) {
    throw "signature verification failed."
  }

  // Calculate how far over (or under) committed this contribution makes the contract.
  const maxCommitment = getCurrentMaximum(requestedSatoshis, recipients.length, committedSatoshis, commitmentCount)
  const currentFloor = getCurrentFloor(requestedSatoshis, recipients.length, committedSatoshis, commitmentCount)

  // Verify that the current contribution does not undercommit the contract floor.
  if (commitment.satoshis < currentFloor) {
    // Send an BAD REQUEST signal back to the client.
    throw new FlipstarterErrors.UnderCommitmentError(commitment.satoshis, currentFloor)
  }

  // Verify that the current contribution does not overcommit the contract.
  if (commitment.satoshis > maxCommitment) {
    // Send an BAD REQUEST signal back to the client.
    throw new FlipstarterErrors.OverCommitmentError(commitment.satoshis, maxCommitment)
  }

  return commitment
}


function getOutputScriptPubKeyHex(output) {
  const scriptPubKey = output.scriptPubKey
  const scriptPubKeyHex = typeof(scriptPubKey) === 'object' ? scriptPubKey.hex : scriptPubKey
  if (typeof(scriptPubKeyHex) !== 'string') {
    throw new Error('invalid script pubkey')
  }

  return scriptPubKeyHex
}

function getOutputValue(output) {
  if(output.value_satoshi) {
    return output.value_satoshi
  } 

  if (Number.isInteger(output.value)) {
    return output.value
  }

  return Number((output.value * SATS_PER_BCH).toFixed())
}

function getCurrentFloor(requestedSatoshis, requestedCount, committedSatoshis, committedCount) {

  const currentMinerFee = calculateMinerFee(requestedCount, committedCount);

  // Calculate the current floor
  const base = requestedSatoshis + currentMinerFee - committedSatoshis
  const modifier = inputPercentModifier(0.75, currentMinerFee, requestedSatoshis, committedSatoshis, committedCount)
  return Math.ceil(base * modifier);
}

function getCurrentMaximum(requestedSatoshis, requestedCount, committedSatoshis, committedCount){
  const currentMinerFee = calculateMinerFee(requestedCount, committedCount)
  return Math.round((requestedSatoshis + currentMinerFee) - committedSatoshis)
}

function getScriptHash(hexString) {
  // Store the inputs lockscript.
  // Hash the inputs lockscript to use for requesting UTXOs (Why can't electrum take the UTXO directly and give me info about it???)
  const hexBuffer = Buffer.from(hexString, "hex")
  const hash = bitbox.Crypto.sha256(hexBuffer);
  return reverseBuf(hash).toString("hex")
}

async function getCommitmentInfoFromInput(electrum, commitment) {
 
  // Fetch the referenced transaction.
  const inputTransaction = await electrum.request("blockchain.transaction.get", commitment.txHash, true);

  // Check if the transaction has error code 2 (missing UTXO).
  if (!inputTransaction || inputTransaction.code === 2) {
    return
  }

  // Store the inputs value.
  // Useful to log these since relies on electrum
  const vout = inputTransaction.vout[commitment.txIndex]
  const inputValue = getOutputValue(vout)
  const inputLockScriptHexString = getOutputScriptPubKeyHex(vout)

  // Store commitment to database.
  return {
    txHash: commitment.txHash,
    txIndex: commitment.txIndex,
    unlockingScript: commitment.unlockingScript,
    lockingScript: inputLockScriptHexString,
    scriptHash: getScriptHash(inputLockScriptHexString),
    seqNum: 0xffffffff,
    satoshis: inputValue,
  }
}