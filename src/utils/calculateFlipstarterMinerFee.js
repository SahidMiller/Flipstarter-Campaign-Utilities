module.exports = (RECIPIENT_COUNT, CONTRIBUTION_COUNT) => {
  // Aim for two satoshis per byte to get a clear margin for error and priority on fullfillment.
  const TARGET_FEE_RATE = 2;

  // Define byte weights for different transaction parts.
  const TRANSACTION_METADATA_BYTES = 10;
  const AVERAGE_BYTE_PER_RECIPIENT = 69;
  const AVERAGE_BYTE_PER_CONTRIBUTION = 296;

  // Calculate the miner fee necessary to cover a fullfillment transaction with the next (+1) contribution.
  const MINER_FEE =
    (TRANSACTION_METADATA_BYTES +
      AVERAGE_BYTE_PER_RECIPIENT * RECIPIENT_COUNT +
      AVERAGE_BYTE_PER_CONTRIBUTION * (CONTRIBUTION_COUNT + 1)) *
    TARGET_FEE_RATE;

  // Return the calculated miner fee.
  return MINER_FEE;
};