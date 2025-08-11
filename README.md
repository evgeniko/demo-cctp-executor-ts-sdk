# CCTP Executor Transfer

Cross-chain USDC transfers via official Wormhole CCTP + Executor contracts.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp env.template .env
   # Edit .env and add your PRIVATE_KEY
   ```

3. **Configure transfer**
   Edit `cctp-transfer.ts` and change only these two variables:
   ```typescript
   const SOURCE_CHAIN = 'BASE_SEPOLIA';
   const DESTINATION_CHAIN = 'ETHEREUM_SEPOLIA';
   ```

4. **Run transfer**
   ```bash
   npm run transfer
   ```

## Configuration

### Available Chains

- `BASE_SEPOLIA` - Base Sepolia testnet
- `ETHEREUM_SEPOLIA` - Ethereum Sepolia testnet  
- `AVALANCHE_FUJI` - Avalanche Fuji testnet
- `SOLANA` - Solana (for destination only)

## Transfer Parameters

You can customize these parameters in `cctp-transfer.ts`:

```typescript
const TOKEN_AMOUNT = '0.21';  // Amount of USDC to transfer
const RECIPIENT = '0x87E27607eF776Df3d76a817b30B0b27da6B8afF1';  // Destination address
```

## API Endpoints

- **Testnet**: `https://executor-testnet.labsapis.com`
- **Mainnet**: `https://executor.labsapis.com`

Change the `EXECUTOR_API` variable in the script to switch between environments.

## Gas Configuration

The script includes automatic gas estimation with a 200% buffer:

```typescript
const GAS_BUFFER_PERCENTAGE = 200; // 200% buffer
const MIN_GAS_LIMIT = 1000000n; // 1M gas minimum
```

## Chain-Specific Configuration

### EVM Chains 
- **`msgValue`**: Always `0` - EVM chains don't use msgValue for CCTP transfers
- **`gasLimit`**: Determines transaction costs and priority fees

### Solana
- **`msgValue`**: Calculated based on Solana operation costs
- **`gasLimit`**: `250,000` compute units set


## Additional Files

### `src/generate-solana-key.ts`
Utility script for generating Solana private keys in base58 format. Useful for testing and development on Solana devnet.

```bash
npx tsx src/generate-solana-key.ts
```