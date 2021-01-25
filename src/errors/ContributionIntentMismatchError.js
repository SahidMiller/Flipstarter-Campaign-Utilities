module.exports = class ContributionIntentMismatchError extends Error {
	constructor(totalSatoshis, contributionAmount) {
		super(`The contribution amount ('${Math.round(totalSatoshis)}') does not match the provided intent (${contributionAmount}).`, null, null)
	}
}