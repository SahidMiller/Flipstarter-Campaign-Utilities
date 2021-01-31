const EventEmitter = require("events")
const AssuranceContract = require('./FlipstarterAssuranceContract')
const validateCommitmentUtxo = require("./utils/validateCommitmentUtxo")
const validateCommitment = require('./utils/validateCommitment')
const FlipstarterErrors = require('./errors')

const { Mutex } = require('async-mutex')

module.exports = class FlipstarterCommitmentWatcher extends EventEmitter {
  
  constructor(electrum) {
    super()

    this.electrum = electrum
    // initialize a revocation event check lock.
    this.submissionLock = new Mutex();
    this.handleRevocationsLock = new Mutex()
    this.checkForTransactionUpdatesLock = new Mutex()
    this.subscribedScriphashes = {}
  }

  async checkForTransactionUpdates(scriptHash, commitments) {
    
    if (!commitments || !commitments.length) {
      return
    }

    // Get a list of unspent outputs for the input address.
    // Locate the UTXO in the list of unspent transaction outputs.
    const inputUTXOs = await this.electrum.request("blockchain.scripthash.listunspent", scriptHash);

    // Get a mutex lock ready.
    const unlock = await this.checkForTransactionUpdatesLock.acquire();

    try {
      
      await Promise.all(commitments.map(async (commitment) => {

        if (!commitment.revoked) {
          
          // Validate the that referenced transaction output is unspent...
          const validCommitment = inputUTXOs && inputUTXOs.length && !!inputUTXOs.find((utxo) => {
            return utxo.tx_hash === commitment.txHash && utxo.tx_pos === commitment.txIndex
          })

          if (!validCommitment) {

            await this.unsubscribeToCommitment(commitment)

          } else {
            
            await this.subscribeToCommitment(commitment)
          }
        }
      }))

    } finally {
      // Unlock the mutex so the next process can continue.
      unlock();
    }
  }

  async handleRevocations(data) {    
    // Check if the notification is a status update.
    if (Array.isArray(data)) {
      // Get the script hash.
      const scriptHash = data[0];
      const scriptHashStatus = data[1];

      // Get a mutex lock ready.
      const unlock = await this.handleRevocationsLock.acquire();

      try {

        const subscription = this.subscribedScriphashes[scriptHash] || { status: false, commitments: [] }
        this.subscribedScriphashes[scriptHash] = subscription

        // If this event is new or has a changed scripthash status..
        if (subscription.status !== scriptHashStatus) {
          // Update this scripthash status to prevent redundant work..
          subscription.status = scriptHashStatus
          await this.checkForTransactionUpdates(scriptHash, subscription.commitments)
        }

      } finally {
        // Unlock the mutex so the next process can continue.
        unlock();
      }
    }
  }

  async subscribeToCommitments(commitments) {
    await Promise.all(commitments.map(this.subscribeToCommitment.bind(this)))
  }

  async subscribeToCommitment(commitment) {

    //For now require a campaignId in the watcher in case multiple campaigns are run
    if (!commitment.campaignId) {
      throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'campaignId' property")
    } 

    if (!commitment.txHash) {
      throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'txHash' property")
    } 

    if (!Number.isInteger(commitment.txIndex)) {
      throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'txIndex' property")
    }

    if (!commitment.scriptHash) {
      throw new FlipstarterErrors.ContributionVerificationError("Commitment requires 'scriptHash' property")
    }

    // If we have not yet subscribed to this script hash..
    const subscription = this.subscribedScriphashes[commitment.scriptHash] || { status: false, commitments: [] }

    this.subscribedScriphashes[commitment.scriptHash] = subscription

    if (!subscription.status) {
      // Mark this scripthash as subscribed to.
      subscription.status = true
      
      if (!subscription.commitments.length) {
        // Subscribe to changes for this output.
        await this.electrum.subscribe(this.handleRevocations.bind(this), "blockchain.scripthash.subscribe", commitment.scriptHash)
      }
    }

    if (!subscription.commitments.find(c => c.txHash === commitment.txHash && c.txIndex === commitment.txIndex && c.campaignId === commitment.campaignId)) {
      subscription.commitments.push(commitment)
      this.emit("commitment-accepted", commitment)
    }
  }

  async unsubscribeToCommitment(commitment) {
    // If we have not yet subscribed to this script hash..
    const subscription = this.subscribedScriphashes[commitment.scriptHash] || { status: false, commitments: [] }
    this.subscribedScriphashes[commitment.scriptHash] = subscription

    if (subscription.status) {
      
      // Mark this scripthash as no longer subscribed to.
      subscription.commitments = subscription.commitments.filter(c => c.txHash !== commitment.txHash || c.txIndex !== commitment.txIndex || c.campaignId !== commitment.campaignId)

      if (!subscription.commitments.length) {

        subscription.status = false

        // Unsubscribe to changes for this output.
        this.electrum.request("blockchain.scripthash.unsubscribe", commitment.scriptHash);
      }

      this.emit("commitment-revoked", commitment)
    }
  }

  async checkAllCommitmentsForUpdates(commitments) {
    const self = this

    // Wait for all verifications to complete.
    let commitmentsByScriptHash = commitments.reduce((commitmentsByScriptHash, commitment) => {
      commitmentsByScriptHash[commitment.scriptHash] = commitmentsByScriptHash[commitment.scriptHash] || []
      commitmentsByScriptHash[commitment.scriptHash].push(commitment)
      return commitmentsByScriptHash
    }, {})

    await Promise.all(Object.keys(commitmentsByScriptHash).map((scriptHash => {
      return self.checkForTransactionUpdates(scriptHash, commitmentsByScriptHash[scriptHash])
    })))
  }

  async validateCommitment(recipients, committedSatoshis, commitmentCount, commitmentData) {

    // Get a mutex lock ready.
    const unlockSubmissions = await this.submissionLock.acquire();

    // Validate and store contribution.
    try {

      return await validateCommitment(this.electrum, recipients, committedSatoshis, commitmentCount, commitmentData)
     
    } finally {

      // Unlock the mutex so the next process can continue.
      unlockSubmissions();
    }
  }

  async fullfillCampaign(recipients, commitments) {
    const unlock = await this.checkForTransactionUpdatesLock.acquire();
    
    try {

      const contract = new AssuranceContract()
      
      recipients.forEach(({ address, satoshis }) => {
        contract.addOutput(satoshis, address)
      })

      commitments.forEach(commitment => contract.addCommitment({
        txHash: Buffer.from(commitment.txHash, 'hex'),
        txIndex: commitment.txIndex,
        unlockingScript: Buffer.from(commitment.unlockingScript, 'hex'),
        seqNum: commitment.seqNum,
        value: commitment.satoshis,
      }))

      // Assemble commitments into transaction
      const rawTransaction = contract.assembleTransaction().toString("hex")

      // Broadcast transaction
      const result = await this.electrum.request("blockchain.transaction.broadcast", rawTransaction)

      if (result.name === "Error") {
        throw result
      } 

      return result
    
    } finally {

      unlock()
    }
  }
}