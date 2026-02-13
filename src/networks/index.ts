/**
 * Network configuration and utilities for EVM chains
 * Spec compliance: x402 v2 - CAIP-2 network identifiers (EIP-155)
 * @module networks
 */

import type { NetworkConfig, EVMNetworkId } from '../types/index.js';
import {
  NETWORK_CONFIGS,
  EXPLORER_URLS,
  EVM_NETWORKS,
  NETWORK_REFERENCES,
  NETWORK_TYPES,
  CHAIN_ID_TO_REFERENCE,
  type NetworkReference,
  type NetworkType,
} from './constants.js';
import { err } from '../errors.js';

/**
 * Get network configuration for a given network
 * @param network - The network identifier (CAIP-2 format)
 * @returns Network configuration
 *
 * @example
 * ```typescript
 * const config = getNetworkConfig('eip155:8453');
 * console.log(config.rpcUrl); // https://mainnet.base.org
 * ```
 */
export function getNetworkConfig(network: EVMNetworkId): NetworkConfig {
  return NETWORK_CONFIGS[network];
}

/**
 * Get network identifier from chain ID
 * @param chainId - The chain ID (numeric)
 * @returns Network identifier in CAIP-2 format
 * @throws Error if chain ID is not recognized
 *
 * @example
 * ```typescript
 * const network = getNetworkFromChainId(8453);
 * console.log(network); // 'eip155:8453'
 * ```
 */
export function getNetworkFromChainId(chainId: number): EVMNetworkId {
  const network = `eip155:${chainId}` as EVMNetworkId;

  if (!isEVMNetwork(network)) {
    throw err.notFound(`Network with chain ID ${chainId}`);
  }

  return network;
}

/**
 * Get chain ID from network identifier
 * @param network - The network identifier (CAIP-2 format)
 * @returns Chain ID (numeric)
 *
 * @example
 * ```typescript
 * const chainId = getChainIdFromNetwork('eip155:8453');
 * console.log(chainId); // 8453
 * ```
 */
export function getChainIdFromNetwork(network: EVMNetworkId): number {
  const config = NETWORK_CONFIGS[network];
  return config.chainId;
}

/**
 * Check if a network is a testnet
 * @param network - The network identifier
 * @returns True if the network is a testnet
 *
 * @example
 * ```typescript
 * console.log(isTestnet('eip155:84532')); // true
 * console.log(isTestnet('eip155:8453')); // false
 * ```
 */
export function isTestnet(network: EVMNetworkId): boolean {
  return NETWORK_TYPES[network] === 'testnet';
}

/**
 * Check if a network is mainnet
 * @param network - The network identifier
 * @returns True if the network is mainnet
 *
 * @example
 * ```typescript
 * console.log(isMainnet('eip155:1')); // true
 * console.log(isMainnet('eip155:11155111')); // false
 * ```
 */
export function isMainnet(network: EVMNetworkId): boolean {
  return NETWORK_TYPES[network] === 'mainnet';
}

/**
 * Check if a network is local (Hardhat/Anvil)
 * @param network - The network identifier
 * @returns True if the network is local
 */
export function isLocal(network: EVMNetworkId): boolean {
  return NETWORK_TYPES[network] === 'local';
}

/**
 * Get all supported networks
 * @returns Array of supported network identifiers in CAIP-2 format
 *
 * @example
 * ```typescript
 * const networks = getSupportedNetworks();
 * console.log(networks); // ['eip155:1', 'eip155:8453', ...]
 * ```
 */
export function getSupportedNetworks(): Array<EVMNetworkId> {
  return Object.keys(NETWORK_CONFIGS) as Array<EVMNetworkId>;
}

/**
 * Get networks by type (mainnet, testnet, local)
 * @param type - Network type to filter by
 * @returns Array of network identifiers
 */
export function getNetworksByType(type: NetworkType): Array<EVMNetworkId> {
  return getSupportedNetworks().filter((n) => NETWORK_TYPES[n] === type);
}

/**
 * Get explorer URL for a transaction
 * @param network - The network identifier
 * @param txHash - The transaction hash
 * @returns Full URL to view transaction, or null if no explorer
 *
 * @example
 * ```typescript
 * const url = getTransactionUrl('eip155:8453', '0x1234...');
 * console.log(url); // 'https://basescan.org/tx/0x1234...'
 * ```
 */
export function getTransactionUrl(
  network: EVMNetworkId,
  txHash: string
): string | null {
  const explorerUrl = EXPLORER_URLS[network];
  if (!explorerUrl) {
    return null;
  }
  return `${explorerUrl}/tx/${txHash}`;
}

/**
 * Get explorer URL for an address
 * @param network - The network identifier
 * @param address - The contract or account address
 * @returns Full URL to view address, or null if no explorer
 *
 * @example
 * ```typescript
 * const url = getAddressUrl('eip155:8453', '0x1234...');
 * console.log(url); // 'https://basescan.org/address/0x1234...'
 * ```
 */
export function getAddressUrl(
  network: EVMNetworkId,
  address: string
): string | null {
  const explorerUrl = EXPLORER_URLS[network];
  if (!explorerUrl) {
    return null;
  }
  return `${explorerUrl}/address/${address}`;
}

/**
 * Validate network configuration
 * @param network - The network identifier
 * @throws Error if network configuration is invalid
 */
export function validateNetworkConfig(network: EVMNetworkId): void {
  const config = getNetworkConfig(network);

  if (!config.chainId) {
    throw err.invalid(`Network ${network} missing chain ID`, { network });
  }

  if (!config.rpcUrl) {
    throw err.invalid(`Network ${network} missing RPC URL`, { network });
  }

  try {
    new URL(config.rpcUrl);
  } catch {
    throw err.invalid(`Network ${network} has invalid RPC URL`, {
      network,
      rpcUrl: config.rpcUrl,
    });
  }
}

/**
 * Check if a string is a valid EVM network identifier
 * @param network - String to check
 * @returns True if the string is a valid EVM network identifier
 *
 * @example
 * ```typescript
 * if (isEVMNetwork(userInput)) {
 *   // userInput is now typed as EVMNetworkId
 *   const config = getNetworkConfig(userInput);
 * }
 * ```
 */
export function isEVMNetwork(network: string): network is EVMNetworkId {
  return (EVM_NETWORKS as ReadonlyArray<string>).includes(network);
}

/**
 * Parse a CAIP-2 EVM network identifier into its components
 * @param caip2 - CAIP-2 network identifier (e.g., "eip155:8453")
 * @returns Object with namespace ("eip155") and chainId
 * @throws Error if not a valid EVM CAIP-2 identifier
 *
 * @example
 * ```typescript
 * const { namespace, chainId } = parseEVMNetwork('eip155:8453');
 * console.log(namespace);  // 'eip155'
 * console.log(chainId);    // 8453
 * ```
 */
export function parseEVMNetwork(caip2: string): {
  namespace: 'eip155';
  chainId: number;
  reference: NetworkReference;
} {
  if (!caip2.startsWith('eip155:')) {
    throw err.invalid(`Invalid EVM CAIP-2 identifier: ${caip2}`, {
      caip2,
      expected: 'eip155:{chainId}',
    });
  }

  const chainIdStr = caip2.slice(7); // Remove "eip155:" prefix
  const chainId = parseInt(chainIdStr, 10);

  if (isNaN(chainId)) {
    throw err.invalid(`Invalid chain ID in CAIP-2 identifier: ${chainIdStr}`, {
      caip2,
    });
  }

  const reference = CHAIN_ID_TO_REFERENCE[chainId];
  if (!reference) {
    throw err.invalid(`Unsupported chain ID: ${chainId}`, {
      caip2,
      supportedChainIds: Object.keys(CHAIN_ID_TO_REFERENCE),
    });
  }

  return { namespace: 'eip155', chainId, reference };
}

/**
 * Build a CAIP-2 identifier from a chain ID
 * @param chainId - Numeric chain ID
 * @returns CAIP-2 network identifier
 *
 * @example
 * ```typescript
 * const network = buildEVMCAIP2(8453);
 * console.log(network); // 'eip155:8453'
 * ```
 */
export function buildEVMCAIP2(chainId: number): EVMNetworkId {
  const network = `eip155:${chainId}` as EVMNetworkId;
  if (!isEVMNetwork(network)) {
    throw err.invalid(`Unsupported chain ID: ${chainId}`);
  }
  return network;
}

/**
 * Get the network reference from a CAIP-2 identifier
 * @param network - CAIP-2 network identifier
 * @returns Network reference (e.g., "ethereum", "base", "polygon")
 *
 * @example
 * ```typescript
 * const ref = getNetworkReference('eip155:8453');
 * console.log(ref); // 'base'
 * ```
 */
export function getNetworkReference(network: EVMNetworkId): NetworkReference {
  return NETWORK_REFERENCES[network];
}

/**
 * Validate a network string and return it as a typed EVMNetworkId
 * @param network - Network string to validate
 * @returns Validated network identifier
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * try {
 *   const validNetwork = validateNetwork(userInput);
 *   // validNetwork is now typed as EVMNetworkId
 * } catch (error) {
 *   console.error('Invalid network:', error.message);
 * }
 * ```
 */
export function validateNetwork(network: string): EVMNetworkId {
  if (!isEVMNetwork(network)) {
    throw err.invalid(
      `Unsupported EVM network: ${network}. Supported: ${EVM_NETWORKS.join(', ')}`,
      { network, supported: EVM_NETWORKS }
    );
  }
  return network;
}

/**
 * Check if two network identifiers refer to the same network
 * Handles format normalization
 */
export function networksEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Normalize network identifier to CAIP-2 format
 */
export function normalizeNetwork(network: string): string {
  return network.toLowerCase();
}

/**
 * Convert chain ID to CAIP-2 format
 */
export function toCAIP2Network(chainId: number): EVMNetworkId {
  return buildEVMCAIP2(chainId);
}

/**
 * Check if string is a valid CAIP-2 EVM network identifier
 */
export function isCAIP2Network(network: string): boolean {
  return network.startsWith('eip155:') && isEVMNetwork(network);
}

// Re-export constants
export {
  EVM_NETWORKS,
  NETWORK_CONFIGS,
  NETWORK_REFERENCES,
  NETWORK_TYPES,
  CHAIN_IDS,
  CHAIN_ID_TO_REFERENCE,
  DEFAULT_RPC_URLS,
  EXPLORER_URLS,
  NETWORK_NAMES,
  NATIVE_CURRENCIES,
  DEFAULT_PROVIDER_TIMEOUT,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_BACKOFF_MULTIPLIER,
  DEFAULT_CONFIRMATIONS,
  type NetworkReference,
  type NetworkType,
} from './constants.js';
