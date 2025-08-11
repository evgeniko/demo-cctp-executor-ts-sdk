import 'dotenv/config';
import { parseUnits, Wallet, Contract, JsonRpcProvider } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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
  addressToBytes32WithSolana,
  createSolanaRelayInstructions, 
  createEVMRelayInstructions
} from './helpers.js';

// TODO: CONFIGURATION SECTION
// Only change these two variables to configure the transfer
const SOURCE_CHAIN = 'BASE_SEPOLIA';
const DESTINATION_CHAIN = 'SOLANA_DEVNET'; 
// Transfer parameters
const TOKEN_AMOUNT = '0.131';
const RECIPIENT = '6wqdVJ4wGCnQBqQxY44NV829m1qn8eSDy52zDh5TuFz7'
// const RECIPIENT = '0x87E27607eF776Df3d76a817b30B0b27da6B8afF1'; 

// API endpoints
const EXECUTOR_API = 'https://executor-testnet.labsapis.com'; // Change to 'https://executor.labsapis.com' for mainnet
const SOLANA_GAS_LIMIT = 250000; 

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

// Check if Solana ATA exists
async function checkSolanaATAExists(recipient: string): Promise<boolean> {
  try {
    const connection = new Connection(RPC_URLS.SOLANA_DEVNET, 'confirmed');
    const recipientPubkey = new PublicKey(recipient);
    const usdcMint = new PublicKey(USDC_ADDRESSES.SOLANA_DEVNET);
    const ata = await getAssociatedTokenAddress(usdcMint, recipientPubkey);
    
    // Check if the account exists
    const accountInfo = await connection.getAccountInfo(ata);
    return accountInfo !== null;
  } catch (error) {
    console.log('Error checking ATA existence:', error);
    return false;
  }
}

// Get minimum rent exemption for token accounts
async function getMinimumRentExemption(): Promise<number> {
  try {
    const connection = new Connection(RPC_URLS.SOLANA_DEVNET, 'confirmed');
    const dataLength = 165;
    const minBalForRentExemption = await connection.getMinimumBalanceForRentExemption(dataLength);
    console.log(`Minimum rent exemption for ${dataLength} bytes: ${minBalForRentExemption} lamports`);
    return minBalForRentExemption;
  } catch (error) {
    console.log('Error getting minimum rent exemption, using fallback value');
    return 2039280; 
  }
}

// Get quote from executor API
async function getExecutorQuote(srcChainId: number, dstChainId: number, recipient: string, gasLimit: number) {
  let relayInstructions;
  if (dstChainId === 1) {
    // Check if ATA exists first
    const ataExists = await checkSolanaATAExists(recipient);
    
    // Calculate msgValue based on working implementation pattern
    let msgValue = 5001n; // SOLANA_MSG_VALUE_BASE_FEE
    

    // TODO: Add extra for CCTP v2 operations
    // msgValue += 1_200_000n;  
    if (!ataExists) {
      const minimumRent = await getMinimumRentExemption();
      msgValue += BigInt(minimumRent);
    }
    console.log(`Using calculated msgValue: ${msgValue} lamports (${Number(msgValue) / 1e9} SOL)`);
    
    // Create relay instructions with calculated msgValue
    if (!ataExists) {
      console.log('ATA does not exist. Adding GasDropOffInstruction to enable automatic ATA creation.');
      const minimumRent = await getMinimumRentExemption();
      relayInstructions = createSolanaRelayInstructions(BigInt(gasLimit), msgValue, recipient, BigInt(minimumRent));
    } else {
      relayInstructions = createSolanaRelayInstructions(BigInt(gasLimit), msgValue);
    }
  } else {
    relayInstructions = createEVMRelayInstructions(recipient, BigInt(gasLimit));
  }

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
    const approveTx = await usdc.approve(cctpContract, '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    await approveTx.wait();
    console.log('Approved USDC with unlimited allowance!\n');
  }
}

async function main() {
  const srcConfig = getChainConfig(SOURCE_CHAIN);
  const dstConfig = getChainConfig(DESTINATION_CHAIN);

  console.log(`Amount: ${TOKEN_AMOUNT} USDC`);
  console.log(`Recipient: ${RECIPIENT}`);
  console.log(`Source Chain: ${SOURCE_CHAIN} (Chain ID: ${srcConfig.chainId})`);
  console.log(`Destination Chain: ${DESTINATION_CHAIN} (Chain ID: ${dstConfig.chainId})`); 

  // Setup
  const provider = new JsonRpcProvider(srcConfig.rpcUrl);
  const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);
  const tokenAmount = parseUnits(TOKEN_AMOUNT, 6);
  
  const usdc = new Contract(srcConfig.usdcAddress, USDC_ABI, wallet);
  const balance = await usdc.balanceOf(wallet.address);
  console.log(`USDC Balance: ${parseFloat(balance.toString()) / 1e6} USDC\n`);
  
  if (balance < tokenAmount) {
    throw new Error(`Insufficient USDC balance`);
  }

  // Approve USDC if needed
  await approveUSDC(usdc, tokenAmount, wallet.address, srcConfig.executorAddress);

  // Convert recipient address to bytes32 format based on destination chain
  const recipientBytes32 = dstConfig.chainId === 1 
    ? addressToBytes32WithSolana(RECIPIENT)  // Solana destination
    : addressToBytes32(RECIPIENT);  // EVM destination
  const contract = new Contract(srcConfig.executorAddress, CCTP_ABI, wallet);
  
  // Get executor quote with appropriate gas limit
  const gasLimit = dstConfig.chainId === 1 ? SOLANA_GAS_LIMIT : 400000;
  const { signedQuote, relayInstructions: initialRelayInstructions, estimatedCost } = await getExecutorQuote(srcConfig.chainId, dstConfig.chainId, RECIPIENT, gasLimit);
  console.log(`Quote: ${estimatedCost} wei\n`);
  
  const tx = await contract.depositForBurn(
    tokenAmount,
    dstConfig.chainId,
    dstConfig.domain,
    recipientBytes32,
    srcConfig.usdcAddress,
    [wallet.address, signedQuote, initialRelayInstructions],
    [0, '0x0000000000000000000000000000000000000000'], 
    { value: estimatedCost, gasLimit }
  );

  console.log(`Transaction: ${tx.hash}`);
  console.log('Waiting for confirmation...');
  const receipt = await tx.wait();
  
  if (receipt?.status === 1) {
    console.log(`tx hash: ${tx.hash}`);    
    const encodedEndpoint = encodeURIComponent(EXECUTOR_API);
    const env = EXECUTOR_API.includes('testnet') ? 'Testnet' : 'Mainnet';
    console.log(`Track: https://wormholelabs-xyz.github.io/executor-explorer/#/tx/${tx.hash}?endpoint=${encodedEndpoint}&env=${env}`);
    
    // Additional info for Solana transfers
    if (dstConfig.chainId === 1) {
      console.log(`Check Solana devnet explorer: https://explorer.solana.com/address/${RECIPIENT}?cluster=devnet`);
    }
  } else {
    throw new Error('Transaction failed');
  }
}

main().catch(console.error); 