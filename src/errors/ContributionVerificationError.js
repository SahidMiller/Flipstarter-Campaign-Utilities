module.exports = class ContributionVerificationError extends Error {
	constructor(message) {
		super(message || "", null, null)
		this.name = "ContributionVerificationError"
	}
}