/**
 * Token constants and utilities for EVM chains
 * Canonical token addresses for supported networks
 *
 * Includes EIP-2612 (Permit) support for gasless approvals
 */

import type { EVMNetworkId } from '../types/index.js';
import type { PermitDomain } from '../types/payment.js';

/**
 * Supported token symbols
 */
export type TokenSymbol = 'USDC' | 'LINK';

/**
 * Token metadata
 */
export interface TokenInfo {
  symbol: TokenSymbol;
  name: string;
  decimals: number;
  /** Contract address */
  address: string;
}

/**
 * USDC contract addresses by network (ERC-20)
 * USDC uses 6 decimals on all networks
 */
export const USDC_ADDRESSES: Partial<Record<EVMNetworkId, string>> = {
  // Mainnets
  'eip155:1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  'eip155:137': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon (native USDC)
  'eip155:42161': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum (native USDC)
  // Testnets
  'eip155:11155111': '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  'eip155:80002': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Polygon Amoy
  'eip155:421614': '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
} as const;

/**
 * LINK contract addresses by network (ERC-677)
 * LINK uses 18 decimals on all networks
 */
export const LINK_ADDRESSES: Partial<Record<EVMNetworkId, string>> = {
  // Mainnets
  'eip155:1': '0x514910771AF9Ca656af840dff83E8264EcF986CA', // Ethereum
  'eip155:8453': '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196', // Base
  'eip155:137': '0xb0897686c545045aFc77CF20eC7A532E3120E0F1', // Polygon
  'eip155:42161': '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', // Arbitrum
  // Testnets
  'eip155:11155111': '0x779877A7B0D9E8603169DdbD7836e478b4624789', // Sepolia
  'eip155:84532': '0xE4aB69C077896252FAFBD49EFD26B5D171A32410', // Base Sepolia
  'eip155:80002': '0x0Fd9e8d3aF1aaee056EB9e802c3A762a667b1904', // Polygon Amoy
  'eip155:421614': '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E', // Arbitrum Sepolia
} as const;

/**
 * Token decimals by symbol
 */
export const TOKEN_DECIMALS: Record<TokenSymbol, number> = {
  USDC: 6,
  LINK: 18,
} as const;

/**
 * Token names
 */
export const TOKEN_NAMES: Record<TokenSymbol, string> = {
  USDC: 'USD Coin',
  LINK: 'Chainlink',
} as const;

/**
 * All ERC-20 token addresses indexed by symbol and network
 */
export const TOKEN_ADDRESSES: Record<
  TokenSymbol,
  Partial<Record<EVMNetworkId, string>>
> = {
  USDC: USDC_ADDRESSES,
  LINK: LINK_ADDRESSES,
} as const;

/**
 * Get token address for a network
 *
 * @param symbol - Token symbol (USDC, LINK)
 * @param network - Network identifier
 * @returns Token contract address, or undefined if not available
 *
 * @example
 * ```typescript
 * const usdcAddress = getTokenAddress('USDC', 'eip155:8453');
 * console.log(usdcAddress); // '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
 * ```
 */
export function getTokenAddress(
  symbol: TokenSymbol,
  network: EVMNetworkId
): string | undefined {
  return TOKEN_ADDRESSES[symbol][network];
}

/**
 * Get token decimals
 *
 * @param symbol - Token symbol
 * @returns Number of decimals for the token
 *
 * @example
 * ```typescript
 * const decimals = getTokenDecimals('USDC');
 * console.log(decimals); // 6
 * ```
 */
export function getTokenDecimals(symbol: TokenSymbol): number {
  return TOKEN_DECIMALS[symbol];
}

/**
 * Get token name
 *
 * @param symbol - Token symbol
 * @returns Human-readable token name
 */
export function getTokenName(symbol: TokenSymbol): string {
  return TOKEN_NAMES[symbol];
}

/**
 * Get complete token info
 */
export function getTokenInfo(
  symbol: TokenSymbol,
  network: EVMNetworkId
): TokenInfo | undefined {
  const address = getTokenAddress(symbol, network);
  if (address === undefined) {
    return undefined;
  }

  return {
    symbol,
    name: TOKEN_NAMES[symbol],
    decimals: TOKEN_DECIMALS[symbol],
    address,
  };
}

/**
 * Convert human-readable amount to atomic units (smallest unit)
 *
 * @param amount - Amount in human-readable units (e.g., 1.5 for 1.5 USDC)
 * @param symbol - Token symbol
 * @returns Amount in atomic units as string
 *
 * @example
 * ```typescript
 * const atomic = toAtomicUnits(1.5, 'USDC');
 * console.log(atomic); // '1500000' (1.5 * 10^6)
 *
 * const ethAtomic = toAtomicUnits(0.001, 'ETH');
 * console.log(ethAtomic); // '1000000000000000' (0.001 * 10^18)
 * ```
 */
export function toAtomicUnits(amount: number, symbol: TokenSymbol): string {
  const decimals = TOKEN_DECIMALS[symbol];
  // Use BigInt for precision with large numbers
  const multiplier = 10n ** BigInt(decimals);
  // Convert to fixed-point to avoid floating point errors
  const atomicUnits = BigInt(Math.round(amount * Number(multiplier)));
  return atomicUnits.toString();
}

/**
 * Convert atomic units to human-readable amount
 *
 * @param atomicUnits - Amount in atomic units (smallest unit)
 * @param symbol - Token symbol
 * @returns Amount in human-readable units
 *
 * @example
 * ```typescript
 * const amount = fromAtomicUnits('1500000', 'USDC');
 * console.log(amount); // 1.5
 *
 * const ethAmount = fromAtomicUnits('1000000000000000', 'ETH');
 * console.log(ethAmount); // 0.001
 * ```
 */
export function fromAtomicUnits(
  atomicUnits: string,
  symbol: TokenSymbol
): number {
  const decimals = TOKEN_DECIMALS[symbol];
  const divisor = 10 ** decimals;
  return Number(BigInt(atomicUnits)) / divisor;
}

/**
 * Identify token symbol from contract address
 *
 * @param address - Token contract address
 * @param network - Network identifier
 * @returns Token symbol or undefined if not recognized
 *
 * @example
 * ```typescript
 * const symbol = getTokenSymbol(
 *   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *   'eip155:8453'
 * );
 * console.log(symbol); // 'USDC'
 * ```
 */
export function getTokenSymbol(
  address: string,
  network: EVMNetworkId
): TokenSymbol | undefined {
  const normalizedAddress = address.toLowerCase();

  for (const [symbol, addresses] of Object.entries(TOKEN_ADDRESSES)) {
    const networkAddress = addresses[network as keyof typeof addresses];
    if (networkAddress && networkAddress.toLowerCase() === normalizedAddress) {
      return symbol as TokenSymbol;
    }
  }

  return undefined;
}

/**
 * Check if a token is available on a network
 *
 * @param symbol - Token symbol
 * @param network - Network identifier
 * @returns True if the token is available on the network
 *
 * @example
 * ```typescript
 * console.log(isTokenAvailable('USDC', 'eip155:8453')); // true
 * ```
 */
export function isTokenAvailable(
  symbol: TokenSymbol,
  network: EVMNetworkId
): boolean {
  return TOKEN_ADDRESSES[symbol][network] !== undefined;
}

/**
 * Get all available tokens for a network
 *
 * @param network - Network identifier
 * @returns Array of available token symbols
 *
 * @example
 * ```typescript
 * const baseTokens = getAvailableTokens('eip155:8453');
 * console.log(baseTokens); // ['USDC', 'LINK']
 * ```
 */
export function getAvailableTokens(network: EVMNetworkId): Array<TokenSymbol> {
  const tokens: Array<TokenSymbol> = [];

  for (const symbol of ['USDC', 'LINK'] as const) {
    if (TOKEN_ADDRESSES[symbol][network] !== undefined) {
      tokens.push(symbol);
    }
  }

  return tokens;
}

/**
 * ERC-20 ABI for token interactions (minimal)
 */
export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

// ============================================================================
// EIP-2612 Permit Support
// ============================================================================

/**
 * Permit domain info for tokens
 * Includes name, version, and chainId for EIP-712 signing
 *
 * Note: Each token may have different domain parameters.
 * USDC uses version "2" on most chains, DAI uses version "1", etc.
 */
export interface PermitTokenInfo {
  /** Token name for EIP-712 domain (must match token's DOMAIN_SEPARATOR) */
  name: string;
  /** Token version for EIP-712 domain (must match token's DOMAIN_SEPARATOR) */
  version: string;
}

/**
 * Map of tokens that support EIP-2612 permit
 * Key format: `${chainId}:${tokenAddress.toLowerCase()}`
 *
 * This registry contains known EIP-2612 compatible tokens.
 * USDC natively supports permit on all major chains.
 */
export const PERMIT_SUPPORTED_TOKENS: Record<string, PermitTokenInfo> = {
  // ============================================================================
  // Ethereum Mainnet (chainId: 1)
  // ============================================================================
  '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },
  '1:0x6b175474e89094c44da98b954eedeac495271d0f': {
    // DAI
    name: 'Dai Stablecoin',
    version: '1',
  },

  // ============================================================================
  // Base Mainnet (chainId: 8453)
  // ============================================================================
  '8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Arbitrum One (chainId: 42161)
  // ============================================================================
  '42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Optimism (chainId: 10)
  // ============================================================================
  '10:0x0b2c639c533813f4aa9d7837caf62653d097ff85': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Polygon (chainId: 137)
  // ============================================================================
  '137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359': {
    // USDC (native)
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Ethereum Sepolia Testnet (chainId: 11155111)
  // ============================================================================
  '11155111:0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Base Sepolia Testnet (chainId: 84532)
  // ============================================================================
  '84532:0x036cbd53842c5426634e7929541ec2318f3dcf7e': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },

  // ============================================================================
  // Arbitrum Sepolia Testnet (chainId: 421614)
  // ============================================================================
  '421614:0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d': {
    // USDC
    name: 'USD Coin',
    version: '2',
  },
} as const;

/**
 * Check if a token supports EIP-2612 permit
 *
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @returns True if the token is in the permit registry
 *
 * @example
 * ```typescript
 * const supportsPermit = isPermitSupported(
 *   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   8453
 * );
 * console.log(supportsPermit); // true
 * ```
 */
export function isPermitSupported(
  tokenAddress: `0x${string}`,
  chainId: number
): boolean {
  const key = `${chainId}:${tokenAddress.toLowerCase()}`;
  return key in PERMIT_SUPPORTED_TOKENS;
}

/**
 * Get permit domain for a token
 *
 * Returns the EIP-712 domain parameters needed for signing a permit.
 * These parameters must match what the token contract expects.
 *
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @returns PermitDomain or undefined if token doesn't support permit
 *
 * @example
 * ```typescript
 * const domain = getPermitDomain(
 *   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
 *   8453
 * );
 * // Returns:
 * // {
 * //   name: 'USD Coin',
 * //   version: '2',
 * //   chainId: 8453,
 * //   verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
 * // }
 * ```
 */
export function getPermitDomain(
  tokenAddress: `0x${string}`,
  chainId: number
): PermitDomain | undefined {
  const key = `${chainId}:${tokenAddress.toLowerCase()}`;
  const info = PERMIT_SUPPORTED_TOKENS[key];

  if (!info) {
    return undefined;
  }

  return {
    name: info.name,
    version: info.version,
    chainId,
    verifyingContract: tokenAddress,
  };
}

/**
 * Get all permit-supported tokens for a chain
 *
 * @param chainId - Chain ID
 * @returns Array of token addresses that support permit on this chain
 *
 * @example
 * ```typescript
 * const tokens = getPermitSupportedTokens(8453); // Base
 * console.log(tokens); // ['0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913']
 * ```
 */
export function getPermitSupportedTokens(
  chainId: number
): Array<`0x${string}`> {
  const prefix = `${chainId}:`;
  const tokens: Array<`0x${string}`> = [];

  for (const key of Object.keys(PERMIT_SUPPORTED_TOKENS)) {
    if (key.startsWith(prefix)) {
      const address = key.slice(prefix.length);
      tokens.push(address as `0x${string}`);
    }
  }

  return tokens;
}

/**
 * ERC-20 Permit ABI extension (EIP-2612)
 * Add to ERC20_ABI when interacting with permit-enabled tokens
 */
export const ERC20_PERMIT_ABI = [
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;
