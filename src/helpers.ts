// Helper functions for CCTP transfers

import { Layout, serialize } from 'binary-layout';
import { Buffer } from 'buffer';
import bs58 from 'bs58';

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

export function createSolanaRelayInstructions(gasLimit: bigint, msgValue: bigint, recipient?: string, dropOff: bigint = 0n): string {
  const instructions: any[] = [{ request: { type: "GasInstruction", gasLimit, msgValue } }];
  
  // Add GasDropOffInstruction if recipient is provided (enables automatic ATA creation by relayer)
  if (recipient && dropOff > 0n) {
    // Convert Solana address to bytes32 format
    const decoded = Buffer.from(bs58.decode(recipient));
    const recipientBytes32 = `0x${decoded.toString('hex').padStart(64, '0')}`;
    
    instructions.push({ 
      request: { 
        type: "GasDropOffInstruction", 
        dropOff, // Amount to drop off (minimum rent exemption for ATA creation)
        recipient: recipientBytes32
      } 
    });
  }
  
  const relayInstructions = serialize(relayInstructionsLayout, {
    requests: instructions,
  });
  return '0x' + Buffer.from(relayInstructions).toString('hex');
}

// Create EVM relay instructions (Type 2, auto-delivery)
export function createEVMRelayInstructions(recipient: string, gasLimit: bigint, dropOff: bigint = 0n): string {
  const msgValue = 0n;
  
  // Create instructions array
  const instructions: any[] = [{ request: { type: "GasInstruction", gasLimit, msgValue } }];
  
  // Only include GasDropOffInstruction if dropOff > 0
  if (dropOff > 0n) {
    instructions.push({ 
      request: { 
        type: "GasDropOffInstruction", 
        dropOff, 
        recipient: addressToBytes32(recipient) 
      } 
    });
  }
  
  const relayInstructions = serialize(relayInstructionsLayout, {
    requests: instructions,
  });
  
  return '0x' + Buffer.from(relayInstructions).toString('hex');
}

// Convert Solana address to bytes32 format
export function addressToBytes32WithSolana(address: string): string {
  try {
    const decoded = Buffer.from(bs58.decode(address));
    return `0x${decoded.toString('hex').padStart(64, '0')}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to decode Solana address: ${errorMessage}`);
  }
}