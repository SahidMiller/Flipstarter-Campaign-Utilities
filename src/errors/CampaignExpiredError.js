module.exports = class CampaignExpiredError extends Error {
	constructor(campaignId) {
		super(`Campaign ${campaignId} has expired.`, null, null)
		this.name = "CampaignExpiredError"
	}
}