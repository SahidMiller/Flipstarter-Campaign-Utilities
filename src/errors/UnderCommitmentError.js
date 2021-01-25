module.exports = class UnderCommitmentError extends Error {
	constructor(totalSatoshis = 0, currentFloor = 0) {
		super(`The contribution amount ('${Math.round(totalSatoshis)}') undercommits the current floor of (${currentFloor}) satoshis.`, null, null)
		this.name = "UnderCommitmentError"
	}
}