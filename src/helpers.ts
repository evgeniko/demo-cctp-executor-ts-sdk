// Helper functions for CCTP transfers

import { Layout, serialize } from 'binary-layout';
import { Buffer } from 'buffer';

// Binary layout definitions for relay instructions
const gasInstructionLayout = [
  { name: "gasLimit", binary: "uint", size: 16 },
  { name: "msgValue", binary: "uint", size: 16 },
] as const satisfies Layout;

const gasDropOffInstructionLayout = [
  { name: "dropOff", binary: "uint", size: 16 },
  { name: "recipient", binary: "bytes", size: 32 },
] as const satisfies Layout;

const relayInstructionLayout = [
  {
    name: "request",
    binary: "switch",
    idSize: 1,
    idTag: "type",
    layouts: [
      [[1, "GasInstruction"], gasInstructionLayout],
      [[2, "GasDropOffInstruction"], gasDropOffInstructionLayout],
    ],
  },
] as const satisfies Layout;

const relayInstructionsLayout = [
  {
    name: "requests",
    binary: "array",
    layout: relayInstructionLayout,
  },
] as const satisfies Layout;

// Convert Ethereum address to bytes32 format
export function addressToBytes32(address: string): string {
  return '0x' + '000000000000000000000000' + address.slice(2).toLowerCase();
}

// Create Solana relay instructions (Type 1, manual claim)
export function createSolanaRelayInstructions(gasLimit: number = 1400000, msgValue: number = 0): string {
  const relayInstructions = serialize(relayInstructionsLayout, {
    requests: [{ request: { type: "GasInstruction", gasLimit: BigInt(gasLimit), msgValue: BigInt(msgValue) } }],
  });
  return '0x' + Buffer.from(relayInstructions).toString('hex');
}

// Create EVM relay instructions (Type 2, auto-delivery)
export function createEVMRelayInstructions(recipient: string, gasLimit: number, dropOff: number = 0): string {
  const msgValue = 0;
  
  // Create instructions array
  const instructions: any[] = [{ request: { type: "GasInstruction", gasLimit: BigInt(gasLimit), msgValue: BigInt(msgValue) } }];
  
  // Only include GasDropOffInstruction if dropOff > 0
  if (dropOff > 0) {
    instructions.push({ 
      request: { 
        type: "GasDropOffInstruction", 
        dropOff: BigInt(dropOff), 
        recipient: addressToBytes32(recipient) 
      } 
    });
  }
  
  const relayInstructions = serialize(relayInstructionsLayout, {
    requests: instructions,
  });
  
  return '0x' + Buffer.from(relayInstructions).toString('hex');
}

// Solana helper functions

// Base58 decoder for Solana addresses
export function base58Decode(str: string): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = 0n;
  for (let i = 0; i < str.length; i++) {
    const index = alphabet.indexOf(str[i]);
    if (index === -1) throw new Error('Invalid base58 character');
    result = result * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (result > 0n) {
    bytes.unshift(Number(result % 256n));
    result = result / 256n;
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) bytes.unshift(0);
  return '0x' + Buffer.from(bytes).toString('hex').padStart(64, '0');
}

// Legacy Solana relay instructions (deprecated - use createSolanaRelayInstructions instead)
export function createSolanaRelayInstructionsLegacy(gasLimit: number = 1400000, msgValue: number = 0): string {
  const gasLimitHex = gasLimit.toString(16).padStart(32, '0');
  const msgValueHex = msgValue.toString(16).padStart(32, '0');
  return '0x01' + gasLimitHex + msgValueHex;
}

// Legacy EVM relay instructions (deprecated - use createEVMRelayInstructions instead)
export function createEVMRelayInstructionsLegacy(recipient: string, dropOff: number = 0): string {
  // Convert address to bytes32 for EVM
  const recipientHex = '0x' + '000000000000000000000000' + recipient.slice(2).toLowerCase();
  const dropOffHex = dropOff.toString(16).padStart(32, '0');
  return '0x02' + dropOffHex + recipientHex.replace('0x', '');
} 