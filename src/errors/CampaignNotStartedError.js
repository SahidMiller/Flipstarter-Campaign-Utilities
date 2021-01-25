module.exports = class CampaignNotStartedError extends Error {
	constructor(campaignId) {
		super(`Campaign ${campaignId} has not yet started.`, null, null)
		this.name = "CampaignNotStartedError"
	}
}