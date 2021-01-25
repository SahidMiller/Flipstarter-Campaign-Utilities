module.exports = class CampaignFullfilledError extends Error {
	constructor(campaignId) {
		super(`Campaign ${campaignId} has already been fullfilled.`, null, null)
		this.name = "CampaignFullfilledError"
	}
}