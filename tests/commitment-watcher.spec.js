const FlipstarterCommitmentWatcher = require('../src/FlipstarterCommitmentWatcher')
const moment = require('moment')

/**
 * Admin dashboard tests
 * 
 * @group commitment-watcher
 */
 describe('Contribution watcher', () => {
 	let campaignId = "fake"

 	const testTransaction = {
 		txHash: "4da543d3866ee0015a5dc2131de7a20ef8966eeaaf2875b24c7bc575ce5d9e60",
		txIndex: 0,
		unlockingScript: "483045022100c221c2676e1b3a5ee7eab5a68351d4e1b368d3c49b9a09d04f8920b66545a559022063cc58d00594c409b07cd2243cf95ae203a29be5d0eae18bb6def64e9bad298cc12103c00d6cbc1712b782b8f9a6388d5ba7567457766fc7be0594bf52a87d3ee0ee5d",
		seqNum: 4294967295,
		scriptHash: '7a78f4a211778baeff95942c6df00cf1ab95e66d585d10c7877b9ad6ddb7298e',
		scriptPubKey: "76a914543a6f75dea3841ac24aac3a7e1633878abb66e188ac",
		satoshis: 465
 	}

 	let testCommitmentData = { 
		txHash: testTransaction.txHash,
		txIndex: testTransaction.txIndex,
		unlockingScript: testTransaction.unlockingScript,
		seqNum: testTransaction.seqNum
 	}
 	
 	let expectedValidatedCommit = {
		txHash: testTransaction.txHash,
		txIndex: testTransaction.txIndex,
		unlockingScript: testTransaction.unlockingScript,
		lockingScript: testTransaction.scriptPubKey,
		scriptHash: testTransaction.scriptHash,
		seqNum: 0xffffffff,
		satoshis: 465
	}

 	let testRecipients = [{
 		address: "bchtest:qqekcwxmfzhgn775r6t382g08mx4cxclfsd2d2v0x0",
		satoshis: 558
	}]

 	it('should validate commitments', async () => {
 		const electrum = {
 			request: jest.fn()
 		}

 		//Commitment satoshis, lockingScript and scriptHash are based on these returns
 		const transactionGetReturn = { 
 			code: 0, 
 			vout: [{ 
 				value: testTransaction.satoshis, 
 				scriptPubKey: testTransaction.scriptPubKey  
 			}] 
 		}

 		const listUnspentReturn = [{ tx_hash: testTransaction.txHash, tx_pos: 0 }]

 		let called = 0
 		electrum.request.mockImplementation(async (...args) => {
 			switch(called) {
 				//Transaction get
 				case 0:
 					called++
 					return transactionGetReturn
	 			//List-unspent
	 			case 1:
	 				called++
	 				return listUnspentReturn
	 		}
 		})

 		try {
 			
 			const watcher = new FlipstarterCommitmentWatcher(electrum)
 			const actual = await watcher.validateCommitment(testRecipients, 0, 0, testCommitmentData)

 			expect(electrum.request).toHaveBeenCalledTimes(2)
 			expect(electrum.request).toHaveBeenNthCalledWith(1, "blockchain.transaction.get", testTransaction.txHash, true)
 			expect(electrum.request).toHaveBeenNthCalledWith(2, "blockchain.scripthash.listunspent", testTransaction.scriptHash)

 			expect(actual).toEqual(expectedValidatedCommit)

 		} catch (error) {

 			fail(error)
 		}
 	})

 	it('should subscribe and emit for only non-duplicated commitments with unique scriptHashes', async () => {

 		try {
 			const electrum = {
 				subscribe: jest.fn()
 			}

 			const watcher = new FlipstarterCommitmentWatcher(electrum)
 			watcher.emit = jest.fn()

 			const firstCommit = {
 				campaignId,
 				...expectedValidatedCommit
 			}
 			
 			const secondCommit = {
 				campaignId,
 				...expectedValidatedCommit,
 				txIndex: 1
 			}

 			//Should subscribe and emit
 			await watcher.subscribeToCommitment(firstCommit)
 			
 			//Should not subscribe or emit
 			await watcher.subscribeToCommitment(firstCommit)

 			//Should emit but not subscribe
 			await watcher.subscribeToCommitment(secondCommit)

 			expect(electrum.subscribe).toHaveBeenCalledTimes(1)
 			expect(electrum.subscribe).toHaveBeenNthCalledWith(1, expect.anything(), "blockchain.scripthash.subscribe", testTransaction.scriptHash)

 			expect(watcher.emit).toHaveBeenCalledTimes(2)
 			expect(watcher.emit).toHaveBeenNthCalledWith(1, "commitment-accepted", firstCommit)
 			expect(watcher.emit).toHaveBeenNthCalledWith(2, "commitment-accepted", secondCommit)

 		} catch (error) {

 			fail(error)
 		}
 	})

 	it('should revoke commitment and unsubscribe when scriptHash status updates and no utxos are found', async () => {

 		try {

 			let actualCallback
 			let count = 0
 			const electrum = {
 				subscribe: jest.fn(async (cb) => actualCallback = cb),
 				request: jest.fn(async () => {
 					switch (count) {
 						case 0:
		 					//blockchain.scripthash.listunspent so invalid
		 					return []
		 				case 1:
		 					return
		 			}
 				})
 			}

 			const watcher = new FlipstarterCommitmentWatcher(electrum)
 			
 			watcher.emit = jest.fn()

 			const commitment = {
 				campaignId,
 				...expectedValidatedCommit
 			}

 			await watcher.subscribeToCommitment(commitment)

 			await actualCallback([testTransaction.scriptHash, "example-status"])
 			
 			expect(electrum.subscribe).toHaveBeenCalledTimes(1)
 			expect(electrum.subscribe).toHaveBeenNthCalledWith(1, expect.anything(), "blockchain.scripthash.subscribe", testTransaction.scriptHash)

 			expect(watcher.emit).toHaveBeenCalledTimes(2)
 			expect(watcher.emit).toHaveBeenNthCalledWith(1, "commitment-accepted", commitment)
 			expect(watcher.emit).toHaveBeenNthCalledWith(2, "commitment-revoked", commitment)

 			expect(electrum.request).toHaveBeenCalledTimes(2)
 			expect(electrum.request).toHaveBeenNthCalledWith(1, "blockchain.scripthash.listunspent", testTransaction.scriptHash)
 			expect(electrum.request).toHaveBeenNthCalledWith(2, "blockchain.scripthash.unsubscribe", testTransaction.scriptHash)

 		} catch (error) {

 			fail(error)
 		}
 	})

 	it('should not check history again when scriptHash status updates and no commitments for it', async () => {

 		try {

 			let actualCallback
 			let count = 0
 			const electrum = {
 				subscribe: jest.fn(async (cb) => actualCallback = cb),
 				request: jest.fn()
 			}

 			const watcher = new FlipstarterCommitmentWatcher(electrum)
 			await watcher.subscribeToCommitment({
 				campaignId,
 				...expectedValidatedCommit
 			})

 			await actualCallback([testTransaction.scriptHash, "example-status"])

 			watcher.emit = jest.fn()
 			electrum.request = jest.fn()

 			await actualCallback([testTransaction.scriptHash, "example-status"])

 			expect(electrum.request).toHaveBeenCalledTimes(0)
 			expect(watcher.emit).toHaveBeenCalledTimes(0)

 		} catch (error) {

 			fail(error)
 		}
 	})

 	it('checkAllForTransactionUpdates should subscribe and emit for only non-duplicated commitments with unique scriptHashes', async () => {

 		try {
 			const electrum = {
 				subscribe: jest.fn(),
 				request: jest.fn(async () => {
 					return [
 						{ tx_hash: testTransaction.txHash, tx_pos: 0 },
 						{ tx_hash: testTransaction.txHash, tx_pos: 1 }
 					]
 				})
 			}

 			const watcher = new FlipstarterCommitmentWatcher(electrum)
 			watcher.emit = jest.fn()

 			const commitments = [{
 				campaignId,
 				...expectedValidatedCommit
 			}, {
 				campaignId,
 				...expectedValidatedCommit
 			}, {
 				campaignId,
 				...expectedValidatedCommit,
 				txIndex: 1
 			}]

 			//Should subscribe and emit
 			await watcher.checkAllForTransactionUpdates(commitments)

 			expect(electrum.subscribe).toHaveBeenCalledTimes(1)
 			expect(electrum.subscribe).toHaveBeenNthCalledWith(1, expect.anything(), "blockchain.scripthash.subscribe", testTransaction.scriptHash)

 			expect(watcher.emit).toHaveBeenCalledTimes(2)
 			expect(watcher.emit).toHaveBeenNthCalledWith(1, "commitment-accepted", commitments[0])
 			expect(watcher.emit).toHaveBeenNthCalledWith(2, "commitment-accepted", commitments[2])

 		} catch (error) {

 			fail(error)
 		}
 	})
 })