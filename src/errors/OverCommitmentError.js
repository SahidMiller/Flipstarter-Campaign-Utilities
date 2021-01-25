module.exports = class OverCommitmentError extends Error {
	constructor(totalSatoshis = 0, overCommitment = 0) {
		super(`The contribution amount ('${Math.round(totalSatoshis)}') overcommits the contract by (${overCommitment}) satoshis.`, null, null)
		this.name = "OverCommitmentError"
	}
}