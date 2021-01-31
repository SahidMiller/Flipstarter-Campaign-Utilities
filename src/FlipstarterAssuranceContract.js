// Load the bitbox library.
const { BITBOX } = require('bitbox-sdk')
const { varInt, reverseBuf } = require('./utils/buffer')
const TransactionHelper = require('./TransactionHelper')

const bitbox = new BITBOX();

module.exports = class FlipstarterAssuranceContract {
  /**
   * Constructor that takes parameters necessary to construct the assurance contract object.
   *
   *
   */
  constructor() {
    // initialize an empty storage for inputs.
    this.inputs = [];
    this.outputs = [];
  }

  /**
   * Adds an output to the assurance contract.
   *
   * @param satoshis    integer number of satoshis to send to the address.
   * @param address     cashaddr encoded output address to send satoshis to.
   */
  addOutput(satoshis, address) {
    this.outputs.push(TransactionHelper.addOutput(satoshis, address))
  }

  /**
   * Counts the number of outputs for the current contract.
   *
   * @returns the number of outputs as an integer number.
   */
  get countContractOutputs() {
    return this.outputs.length;
  }

  /**
   * Sums up the number of satoshis sent by this contract.
   *
   * @returns the sum of all output values as an integer number of satoshis.
   */
  get totalContractOutputValue() {
    // Initialize an empty counter.
    let totalSatoshis = 0;

    // For each output in this contract..
    for (const currentOutput in this.outputs) {
      totalSatoshis += TransactionHelper.decodeOutputValue(
        this.outputs[currentOutput].value
      );
    }

    // Return the total number of satoshis.
    return totalSatoshis;
  }

  /**
   * Sums the currently total committed value in satoshis.
   *
   * @returns the number of satoshis currently committed to this contracts output.
   */
  get totalCommitmentValue() {
    // Initialize an empty counter.
    let totalSatoshis = 0;

    // For each output in this contract..
    for (const currentInput in this.inputs) {
      totalSatoshis += this.inputs[currentInput].value;
    }

    // Return the total number of satoshis.
    return totalSatoshis;
  }

  /**
   * Calculates how many satoshis are missing to reach fully funded status.
   *
   * @returns the number of satoshis required to complete the contract.
   */
  get remainingCommitmentValue() {
    return Math.max(0, this.totalContractOutputValue - this.totalCommitmentValue);
  }

  //
  addCommitment(commitment) {
    // TODO: Validate this first.
    this.inputs.push(commitment);
  }

  /**
   * Assembles all currently known commitments into a transaction.
   *
   * @return a buffer containing the raw transaction.
   */
  assembleTransaction() {
    // Create a buffered version statement.
    const version = Buffer.from("02000000", "hex");

    // Create the input counter and input data buffers.
    const inputCount = varInt(this.inputs.length);
    const inputs = this.serializeCommitments();

    // Create the output counter and output data buffer.
    const outputCount = varInt(
      Object.keys(this.outputs).length
    );
    const outputs = this.serializeOutputs();

    // Create a buffered disable locktime statement.
    const locktime = Buffer.from("00000000", "hex");

    // Return the assembled transaction.
    return Buffer.concat([
      version,
      inputCount,
      inputs,
      outputCount,
      outputs,
      locktime,
    ]);
  }

  serializeOutputs() {
    let outputBuffers = [];

    for (const currentOutput in this.outputs) {
      const output = this.outputs[currentOutput];

      // Create a lockscript length statement.
      const lockscriptLength = varInt(
        output.locking_script.byteLength
      );

      // Return the serialized output.
      outputBuffers.push(
        Buffer.concat([output.value, lockscriptLength, output.locking_script])
      );
    }

    return Buffer.concat(outputBuffers);
  }

  serializeCommitments() {
    let commitmentBuffers = [];

    for (const currentInput in this.inputs) {
      const commitment = this.inputs[currentInput];

      const sequenceNumber = Buffer.alloc(4);
      sequenceNumber.writeUInt32LE(commitment.seqNum);

      const outputIndex = Buffer.alloc(4);
      outputIndex.writeUInt32LE(commitment.txIndex);

      commitmentBuffers.push(
        AssuranceContract.serializeInput(
          reverseBuf(commitment.txHash),
          outputIndex,
          commitment.unlockingScript,
          sequenceNumber
        )
      );
    }

    return Buffer.concat(commitmentBuffers);
  }

  /**
   * Creates a serialized input part to be used in a raw transaction.
   *
   * @param previousTransactionHash          hash of the transaction we want to spend an output from.
   * @param previousTransactionOutputIndex   index of the previous transactions outputs to spend.
   * @param unlockingScript                     unlock script used to make the output spendable.
   * @param sequenceNumber                   relative locktime or 0xFFFFFFFF to disable.
   *
   * @returns a raw serialized input structure as a buffer.
   */
  static serializeInput(
    previousTransactionHash,
    previousTransactionOutputIndex,
    unlockingScript,
    sequenceNumber
  ) {
    // Create an unlock script length statement.
    let unlockScriptLength = varInt(
      unlockingScript.byteLength
    );

    // return the serialized input structure, as a buffer.
    return Buffer.concat([
      previousTransactionHash,
      previousTransactionOutputIndex,
      unlockScriptLength,
      unlockingScript,
      sequenceNumber,
    ]);
  }
}