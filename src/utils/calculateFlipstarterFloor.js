const SATS_PER_BCH = 100000000;

module.exports = {
  falling: (inputPercent, currentMinerFee, totalContractOutputValue, currentCommittedSatoshis, currentCommitmentCount) => {
    const commitmentsPerTransaction = 650

    // Calculate how many % of the total fundraiser the smallest acceptable contribution is at the moment.
    const remainingValue = currentMinerFee + (totalContractOutputValue - currentCommittedSatoshis);

    const currentTransactionSize = 42; // this.contract.assembleTransaction().byteLength;

    const minPercent = 0 + (remainingValue / (commitmentsPerTransaction - currentCommitmentCount) + 546 / SATS_PER_BCH) / remainingValue;
    const maxPercent = 1 - ((currentTransactionSize + 1650 + 49) * 1.0) / (remainingValue * SATS_PER_BCH);

    const minValue = Math.log(minPercent * 100);
    const maxValue = Math.log(maxPercent * 100);

    // Return a percentage number on a non-linear scale with higher resolution in the lower boundaries.
    return (Math.exp(minValue + (inputPercent * (maxValue - minValue)) / 100) / 100);
  }
}