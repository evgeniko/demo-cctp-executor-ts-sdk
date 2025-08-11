import bs58 from 'bs58';

// Example: Create Solana private key from byte array
const DEVNET_SOL_PRIVATE_KEY = bs58.encode(
  new Uint8Array([218, 95, 129, 45, 67, 89, 12, 34, 56 ]));

console.log('Solana Private Key (base58):');
console.log(DEVNET_SOL_PRIVATE_KEY);