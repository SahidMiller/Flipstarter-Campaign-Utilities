module.exports = async (electrum, commitment) => {
  const { scriptHash, txHash } = commitment
  
  // Get a list of unspent outputs for the input address.
  // Locate the UTXO in the list of unspent transaction outputs.
  const inputUTXOs = await electrum.request("blockchain.scripthash.listunspent", scriptHash);
  const inputUTXO = inputUTXOs && inputUTXOs.find((utxo) => utxo.tx_hash === txHash);
  return typeof inputUTXO !== "undefined"
}