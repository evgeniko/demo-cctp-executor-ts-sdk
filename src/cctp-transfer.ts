import 'dotenv/config';
import { parseUnits, Wallet, Contract, JsonRpcProvider } from 'ethers';
import axios from 'axios';
import { 
  USDC_ADDRESSES, 
  CCTP_EXECUTOR_ADDRESSES,
  CCTP_DOMAINS,
  RPC_URLS,
  WORMHOLE_CHAIN_IDS
} from './constants.js';
import { 
  addressToBytes32, 
  createSolanaRelayInstructions, 
  createEVMRelayInstructions 
} from './helpers.js';

console.log("🚀 CCTP Executor Transfer");

// TODO: CONFIGURATION SECTION
// Only change these two variables to configure the transfer
const SOURCE_CHAIN = 'BASE_SEPOLIA';
const DESTINATION_CHAIN = 'ETHEREUM_SEPOLIA';
// Transfer parameters
const TOKEN_AMOUNT = '0.13';
const RECIPIENT = '0x87E27607eF776Df3d76a817b30B0b27da6B8afF1';
// API endpoints
const EXECUTOR_API = 'https://executor-testnet.labsapis.com'; // Change to 'https://executor.labsapis.com' for mainnet
// Gas configuration
const GAS_BUFFER_PERCENTAGE = 200; // 200% buffer
const MIN_GAS_LIMIT = 1000000n; // 1M gas minimum

// Get chain configuration
function getChainConfig(chainName: string) {
  return {
    chainId: WORMHOLE_CHAIN_IDS[chainName as keyof typeof WORMHOLE_CHAIN_IDS],
    domain: CCTP_DOMAINS[chainName as keyof typeof CCTP_DOMAINS],
    rpcUrl: RPC_URLS[chainName as keyof typeof RPC_URLS],
    usdcAddress: USDC_ADDRESSES[chainName as keyof typeof USDC_ADDRESSES],
    executorAddress: CCTP_EXECUTOR_ADDRESSES[`${chainName}_V1` as keyof typeof CCTP_EXECUTOR_ADDRESSES]
  };
}

// Contract ABIs
const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
];

const CCTP_ABI = [
  'function depositForBurn(uint256 amount, uint16 destinationChain, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, tuple(address refundAddress, bytes signedQuote, bytes instructions) executorArgs, tuple(uint16 dbps, address payee) feeArgs) external payable returns (uint64 nonce)'
];

// Get quote from executor API
async function getExecutorQuote(srcChainId: number, dstChainId: number, recipient: string, gasLimit: number) {
  const relayInstructions = dstChainId === 1 
    ? createSolanaRelayInstructions()
    : createEVMRelayInstructions(recipient, gasLimit);
  
  const response = await axios.post(`${EXECUTOR_API}/v0/quote`, {
    srcChain: srcChainId,
    dstChain: dstChainId,
    relayInstructions
  });
  
  return {
    signedQuote: response.data.signedQuote,
    relayInstructions,
    estimatedCost: BigInt(response.data.estimatedCost || '0')
  };
}

// Check and approve USDC allowance
async function approveUSDC(usdc: Contract, amount: bigint, walletAddress: string, cctpContract: string) {
  const allowance = await usdc.allowance(walletAddress, cctpContract);
  
  if (allowance < amount) {
    console.log('🔐 Approving USDC...');
    const approveTx = await usdc.approve(cctpContract, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    await approveTx.wait();
    console.log('✅ Approved with unlimited allowance!\n');
  }
}

// Calculate final gas limit with buffer
function calculateGasLimit(estimatedGas: bigint): bigint {
  const gasLimit = estimatedGas + (estimatedGas * BigInt(GAS_BUFFER_PERCENTAGE) / 100n);
  console.log(`⛽ Estimated gas: ${estimatedGas}, Using: ${gasLimit} (${GAS_BUFFER_PERCENTAGE}% buffer)`);
  
  const finalGasLimit = gasLimit > MIN_GAS_LIMIT ? gasLimit : MIN_GAS_LIMIT;
  console.log(`⛽ Final gas limit: ${finalGasLimit}\n`);
  
  return finalGasLimit;
}

async function main() {
  const srcConfig = getChainConfig(SOURCE_CHAIN);
  const dstConfig = getChainConfig(DESTINATION_CHAIN);

  console.log(`💰 Amount: ${TOKEN_AMOUNT} USDC`);
  console.log(`📨 Recipient: ${RECIPIENT}`);

  // Setup
  const provider = new JsonRpcProvider(srcConfig.rpcUrl);
  const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);
  const tokenAmount = parseUnits(TOKEN_AMOUNT, 6);
  
  const usdc = new Contract(srcConfig.usdcAddress, USDC_ABI, wallet);
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`💰 USDC Balance: ${parseFloat(balance.toString()) / 1e6} USDC\n`);
  
  if (balance < tokenAmount) {
    throw new Error(`Insufficient USDC balance`);
  }

  // Approve USDC if needed
  await approveUSDC(usdc, tokenAmount, wallet.address, srcConfig.executorAddress);

  // Execute transfer
  const contract = new Contract(srcConfig.executorAddress, CCTP_ABI, wallet);
  
  // Get executor quote with reasonable gas limit
  console.log('💰 Getting quote...');
  const { signedQuote, relayInstructions, estimatedCost } = await getExecutorQuote(srcConfig.chainId, dstConfig.chainId, RECIPIENT, 400000);
  console.log(`✅ Quote: ${estimatedCost} wei\n`);
  
  console.log('🚀 Executing transfer...');
  const tx = await contract.depositForBurn(
    tokenAmount,
    dstConfig.chainId,
    dstConfig.domain,
    addressToBytes32(RECIPIENT),
    srcConfig.usdcAddress,
    [wallet.address, signedQuote, relayInstructions],
    [0, '0x0000000000000000000000000000000000000000'], 
    { value: estimatedCost, gasLimit: 500000 }
  );

  console.log(`📝 Transaction: ${tx.hash}`);
  console.log('⏳ Waiting for confirmation...');
  
  const receipt = await tx.wait();
  
  if (receipt?.status === 1) {
    console.log(`✅ Transferred ${TOKEN_AMOUNT} USDC`);
    console.log(`⛽ tx hash: ${tx.hash}`);
    
    const encodedEndpoint = encodeURIComponent(EXECUTOR_API);
    const env = EXECUTOR_API.includes('testnet') ? 'Testnet' : 'Mainnet';
    console.log(`📊 Track: https://wormholelabs-xyz.github.io/executor-explorer/#/tx/${tx.hash}?endpoint=${encodedEndpoint}&env=${env}`);
  } else {
    throw new Error('Transaction failed');
  }
}

main().catch(console.error); 