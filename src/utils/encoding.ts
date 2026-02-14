/**
 * Encoding and serialization utilities for EVM
 */

import { keccak256, toHex, isAddress, getAddress, hexToBytes } from 'viem';

/**
 * Encode string to base64
 *
 * @param str - String to encode
 * @returns Base64-encoded string
 */
export function encodeBase64(string_: string): string {
  return Buffer.from(string_, 'utf-8').toString('base64');
}

/**
 * Decode base64 string
 *
 * @param encoded - Base64-encoded string
 * @returns Decoded string
 */
export function decodeBase64(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

/**
 * Normalize EVM address (checksummed)
 *
 * @param address - Address to normalize (with or without 0x prefix)
 * @returns Checksummed address with 0x prefix
 *
 * @example
 * ```typescript
 * normalizeAddress('0xabc123...') // '0xABC123...' (checksummed)
 * ```
 */
export function normalizeAddress(address: string): `0x${string}` {
  if (!address || typeof address !== 'string') {
    return address as `0x${string}`;
  }

  // Ensure 0x prefix
  const withPrefix = address.startsWith('0x') ? address : `0x${address}`;

  // Return checksummed address
  try {
    return getAddress(withPrefix as `0x${string}`);
  } catch {
    // If checksum fails, return lowercase
    return withPrefix.toLowerCase() as `0x${string}`;
  }
}

/**
 * Check if an address is valid EVM address
 *
 * @param address - Address to validate
 * @returns True if valid EVM address
 */
export function isValidAddress(address: string): address is `0x${string}` {
  return isAddress(address);
}

/**
 * Compare two addresses (case-insensitive)
 *
 * @param a - First address
 * @param b - Second address
 * @returns True if addresses are equal
 */
export function addressesEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Convert bytes to hex string
 *
 * @param bytes - Uint8Array to convert
 * @returns Hex string with 0x prefix
 */
export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return toHex(bytes);
}

/**
 * Convert hex string to bytes
 *
 * @param hex - Hex string (with 0x prefix)
 * @returns Uint8Array
 */
export function hexToBytesArray(hex: `0x${string}`): Uint8Array {
  return hexToBytes(hex);
}

/**
 * Compute keccak256 hash
 *
 * @param data - Data to hash (string or bytes)
 * @returns Keccak256 hash as hex string
 */
export function hash(data: string | Uint8Array): `0x${string}` {
  if (typeof data === 'string') {
    return keccak256(toHex(data));
  }
  return keccak256(toHex(data));
}

/**
 * Pad hex string to specific byte length
 *
 * @param hex - Hex string to pad
 * @param bytes - Target byte length
 * @returns Padded hex string
 */
export function padHex(hex: string, bytes: number): `0x${string}` {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const targetLength = bytes * 2;
  return `0x${cleanHex.padStart(targetLength, '0')}` as `0x${string}`;
}

/**
 * Convert number to hex string with 0x prefix
 *
 * @param num - Number or bigint to convert
 * @returns Hex string with 0x prefix
 */
export function numberToHex(num: number | bigint): `0x${string}` {
  return `0x${BigInt(num).toString(16)}` as `0x${string}`;
}

/**
 * Convert hex string to number
 *
 * @param hex - Hex string with 0x prefix
 * @returns Number
 */
export function hexToNumber(hex: string): number {
  return Number(BigInt(hex));
}

/**
 * Convert hex string to bigint
 *
 * @param hex - Hex string with 0x prefix
 * @returns BigInt
 */
export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

/**
 * Encode a compact signature from v, r, s components
 *
 * @param v - Recovery id (27 or 28)
 * @param r - R component
 * @param s - S component
 * @returns Compact signature (65 bytes)
 */
export function encodeCompactSignature(
  v: number,
  r: `0x${string}`,
  s: `0x${string}`
): `0x${string}` {
  const rHex = r.slice(2).padStart(64, '0');
  const sHex = s.slice(2).padStart(64, '0');
  const vHex = (v - 27).toString(16).padStart(2, '0');
  return `0x${rHex}${sHex}${vHex}` as `0x${string}`;
}

/**
 * Decode a compact signature to v, r, s components
 *
 * @param signature - Compact signature (65 bytes)
 * @returns Object with v, r, s
 */
export function decodeCompactSignature(signature: `0x${string}`): {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
} {
  const sig = signature.slice(2);
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
  const v = parseInt(sig.slice(128, 130), 16) + 27;
  return { v, r, s };
}
