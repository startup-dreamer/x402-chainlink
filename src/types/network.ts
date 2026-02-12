/**
 * Network type definitions for EVM chains
 * Spec compliance: x402 v2 - CAIP-2 network identifiers (EIP-155)
 */

/**
 * Supported EVM networks (CAIP-2 format)
 * Format: "eip155:{chainId}"
 * @see https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md
 */
export type EVMNetworkId =
  // Mainnets
  | 'eip155:1' // Ethereum
  | 'eip155:8453' // Base
  | 'eip155:137' // Polygon
  | 'eip155:42161' // Arbitrum
  // Testnets
  | 'eip155:11155111' // Ethereum Sepolia
  | 'eip155:84532' // Base Sepolia
  | 'eip155:80002' // Polygon Amoy
  | 'eip155:421614' // Arbitrum Sepolia
  // Local
  | 'eip155:31337'; // Hardhat/Anvil

/**
 * Network type classification
 */
export type NetworkType = 'mainnet' | 'testnet' | 'local';

/**
 * Native currency information
 */
export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Network configuration interface
 */
export interface NetworkConfig {
  /** Network identifier (CAIP-2 format) */
  network: EVMNetworkId;
  /** EVM chain ID (numeric) */
  chainId: number;
  /** RPC endpoint URL */
  rpcUrl: string;
  /** Block explorer URL (null for local) */
  explorerUrl: string | null;
  /** Network display name */
  name: string;
  /** Network type */
  type: NetworkType;
  /** Native currency info */
  nativeCurrency: NativeCurrency;
}

/**
 * EVM account configuration
 */
export interface AccountConfig {
  /** Account address (0x...) */
  address: `0x${string}`;
  /** Private key for signing (optional for read-only) */
  privateKey?: `0x${string}`;
  /** Network the account is on */
  network: EVMNetworkId;
}

/**
 * RPC provider options
 */
export interface ProviderOptions {
  /** Network to connect to */
  network: EVMNetworkId;
  /** Custom RPC URL (overrides default) */
  rpcUrl?: string | undefined;
  /** Request timeout in milliseconds */
  timeout?: number | undefined;
  /** Number of retry attempts */
  retries?: number | undefined;
}

/**
 * Valid CAIP-2 network identifiers
 */
const VALID_NETWORKS: ReadonlySet<string> = new Set([
  'eip155:1',
  'eip155:8453',
  'eip155:137',
  'eip155:42161',
  'eip155:11155111',
  'eip155:84532',
  'eip155:80002',
  'eip155:421614',
  'eip155:31337',
]);

/**
 * Check if a network identifier is valid (CAIP-2 format)
 * @param network - Network identifier to check
 * @returns True if the network is a valid CAIP-2 network
 */
export function isCAIP2Network(network: string): network is EVMNetworkId {
  return VALID_NETWORKS.has(network);
}

/**
 * Validate and return a network identifier
 * @param network - Network identifier to validate
 * @returns The validated network identifier
 * @throws Error if network is not valid
 */
export function toCAIP2Network(network: EVMNetworkId): EVMNetworkId {
  if (!isCAIP2Network(network)) {
    throw new Error(`Invalid network: ${String(network)}`);
  }
  return network;
}

/**
 * Normalize a network identifier (validates CAIP-2 format)
 * @param network - Network identifier
 * @returns Validated network identifier
 */
export function normalizeNetwork(network: EVMNetworkId): EVMNetworkId {
  return toCAIP2Network(network);
}

/**
 * Check if two network identifiers are equal
 * @param a - First network identifier
 * @param b - Second network identifier
 * @returns True if both are the same network
 */
export function networksEqual(a: EVMNetworkId, b: EVMNetworkId): boolean {
  return a === b;
}

/**
 * Extract chain ID from CAIP-2 network identifier
 * @param network - Network identifier in CAIP-2 format
 * @returns Numeric chain ID
 */
export function getChainId(network: EVMNetworkId): number {
  const chainIdStr = network.split(':')[1];
  return parseInt(chainIdStr ?? '0', 10);
}

/**
 * Build CAIP-2 network identifier from chain ID
 * @param chainId - Numeric chain ID
 * @returns Network identifier in CAIP-2 format
 */
export function fromChainId(chainId: number): EVMNetworkId {
  const network = `eip155:${chainId}` as EVMNetworkId;
  if (!isCAIP2Network(network)) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return network;
}
