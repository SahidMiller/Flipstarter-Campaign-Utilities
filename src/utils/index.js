module.exports = {
	calculate: {
		floor: require('./calculateFlipstarterFloor').falling,
		minerFee: require('./calculateFlipstarterMinerFee')
	},
	validation: {
		commitmentSignature: require('./validateCommitmentSignature'),
		commitmentUtxo: require('./validateCommitmentUtxo'),
		commitment: require('./validateCommitment')
	}
}