// Contract addresses and RPC endpoints

// Official Wormhole CCTP Executor contracts (from the integration table)
export const CCTP_EXECUTOR_ADDRESSES = {
  BASE_SEPOLIA_V1: "0x4983C6bD3bB7DA9EECe71cfa7AE4C67CAbf362F0",  
  ETHEREUM_SEPOLIA_V1: "0x0F78904c750801391EbBf308181e9d6fc892B0f3", 
  AVALANCHE_FUJI_V1: "0x2cfEC91B50f657Cc86Ec693542527ac3e03bF742",
  SOLANA_DEVNET_V1: "CXGRA5SCc8jxDbaQPZrmmZNu2JV34DP7gFW4m31uC1zs"
};

// USDC addresses on different networks
export const USDC_ADDRESSES = {
  ETHEREUM_SEPOLIA: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  BASE_SEPOLIA: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  SOLANA_DEVNET: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
};

// RPC endpoints for different networks  
export const RPC_URLS = {
  ETHEREUM_SEPOLIA: "https://ethereum-sepolia.publicnode.com",
  BASE_SEPOLIA: "https://sepolia.base.org",
  AVALANCHE_FUJI: "https://api.avax-test.network/ext/bc/C/rpc",
  SOLANA_DEVNET: "https://api.devnet.solana.com"
};

// Wormhole Chain IDs (for executor API)
export const WORMHOLE_CHAIN_IDS = {
  ETHEREUM_SEPOLIA: 10002,
  BASE_SEPOLIA: 10004, 
  AVALANCHE_FUJI: 6,
  SOLANA_DEVNET: 1
};

// CCTP Domain IDs (these are still needed as they're CCTP-specific, not Wormhole)
export const CCTP_DOMAINS = {
  ETHEREUM_SEPOLIA: 0,
  BASE_SEPOLIA: 6,
  AVALANCHE_FUJI: 1,
  SOLANA_DEVNET: 5
}; 