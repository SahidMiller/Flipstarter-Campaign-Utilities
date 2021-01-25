module.exports = class CampaignDoesNotExistError extends Error {
	constructor(campaignId) {
		super(`Campaign ${campaignId} does not exist.`, null, null)
		this.name = "CampaignDoesNotExistError"
	}
}