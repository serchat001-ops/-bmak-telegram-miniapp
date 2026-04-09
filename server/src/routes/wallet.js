const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');

const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const CHAIN_ID = 56;

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

router.get('/balance/:address', async (req, res) => {
  const { address } = req.params;

  if (!address || !address.startsWith('0x') || address.length !== 42) {
    return res.status(400).json({ error: 'Adresse BSC invalide' });
  }

  const contractAddress = process.env.BMAK_CONTRACT_ADDRESS;

  try {
    const provider = new ethers.JsonRpcProvider(BSC_RPC, { chainId: CHAIN_ID, name: 'bnb' });

    const bnbWei = await provider.getBalance(address);
    const bnbBalance = parseFloat(ethers.formatEther(bnbWei)).toFixed(6);

    let bmakBalance = null;
    let bmakError = null;

    if (contractAddress) {
      try {
        const token = new ethers.Contract(contractAddress, ERC20_ABI, provider);
        const [raw, decimals] = await Promise.all([
          token.balanceOf(address),
          token.decimals(),
        ]);
        bmakBalance = parseFloat(ethers.formatUnits(raw, decimals)).toFixed(4);
      } catch (e) {
        bmakError = 'Impossible de lire le solde BMAK on-chain';
      }
    } else {
      bmakError = 'Contrat BMAK non configuré';
    }

    res.json({
      address,
      bnb: bnbBalance,
      bmak: bmakBalance,
      contractAddress: contractAddress || null,
      error: bmakError || null,
    });
  } catch (err) {
    console.error('[Wallet Balance] Error:', err.message);
    res.status(500).json({ error: 'Erreur de lecture on-chain. Réessayez.' });
  }
});

module.exports = router;
