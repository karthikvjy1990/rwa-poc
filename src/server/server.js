const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression and logging
app.use(compression());
app.use(morgan('combined'));

// Routes
app.use('/api/assets', require('./routes/assets'));
app.use('/api/validators', require('./routes/validators'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ipfs', require('./routes/ipfs'));


//new contract deployment
const USDC_CONTRACT_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDC_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
];
const ethereumProvider = new ethers.providers.JsonRpcProvider(
  process.env.ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com'
);

app.get('/api/PalaniApiTest', async (req, res) => {
  try {
    const network = await ethereumProvider.getNetwork();

    // The USDC address below is deployed on Ethereum Mainnet (chain ID 1).
    if (network.chainId !== 1) {
      throw new Error(`Wrong network: expected Ethereum Mainnet (1), received chain ID ${network.chainId}`);
    }

    const usdcContract = new ethers.Contract(
      USDC_CONTRACT_ADDRESS,
      USDC_ABI,
      ethereumProvider
    );

    const [name, symbol, decimals, totalSupply, blockNumber] = await Promise.all([
      usdcContract.name(),
      usdcContract.symbol(),
      usdcContract.decimals(),
      usdcContract.totalSupply(),
      ethereumProvider.getBlockNumber()
    ]);

    const result = {
      success: true,
      endpoint: 'PalaniApiTest',
      network: network.name,
      chainId: network.chainId,
      contractAddress: USDC_CONTRACT_ADDRESS,
      data: {
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
      },
      blockNumber,
      fetchedAt: new Date().toISOString()
    };

    console.log('\n[PalaniApiTest] Smart contract data fetched successfully:');
    console.log(JSON.stringify(result, null, 2));

    return res.status(200).json(result);
  } catch (error) {
    console.error('[PalaniApiTest] Blockchain read failed:', error.message);
    return res.status(502).json({
      success: false,
      endpoint: 'PalaniApiTest',
      message: 'Unable to fetch smart contract data from Ethereum Mainnet.',
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
