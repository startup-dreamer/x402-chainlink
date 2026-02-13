/**
 * Network constants for EVM chains
 * Spec compliance: x402 v2 - CAIP-2 network identifiers (EIP-155)
 */

import type { NetworkConfig, EVMNetworkId } from '../types/index.js';

/**
 * EVM Chain IDs (numeric)
 */
export const CHAIN_IDS = {
  // Mainnets
  ETHEREUM: 1,
  BASE: 8453,
  POLYGON: 137,
  ARBITRUM: 42161,
  // Testnets
  ETHEREUM_SEPOLIA: 11155111,
  BASE_SEPOLIA: 84532,
  POLYGON_AMOY: 80002,
  ARBITRUM_SEPOLIA: 421614,
  // Local
  LOCAL: 31337,
} as const;

/**
 * Supported EVM networks in CAIP-2 format (eip155:{chainId})
 */
export const EVM_NETWORKS = [
  // Mainnets
  'eip155:1', // Ethereum
  'eip155:8453', // Base
  'eip155:137', // Polygon
  'eip155:42161', // Arbitrum
  // Testnets
  'eip155:11155111', // Ethereum Sepolia
  'eip155:84532', // Base Sepolia
  'eip155:80002', // Polygon Amoy
  'eip155:421614', // Arbitrum Sepolia
  // Local
  'eip155:31337', // Hardhat/Anvil local
] as const satisfies ReadonlyArray<EVMNetworkId>;

/**
 * Network type for categorization
 */
export type NetworkType = 'mainnet' | 'testnet' | 'local';

/**
 * Network reference type (chain name)
 */
export type NetworkReference =
  | 'ethereum'
  | 'base'
  | 'polygon'
  | 'arbitrum'
  | 'ethereum-sepolia'
  | 'base-sepolia'
  | 'polygon-amoy'
  | 'arbitrum-sepolia'
  | 'local';

/**
 * Mapping from chain ID to network reference
 */
export const CHAIN_ID_TO_REFERENCE: Record<number, NetworkReference> = {
  [CHAIN_IDS.ETHEREUM]: 'ethereum',
  [CHAIN_IDS.BASE]: 'base',
  [CHAIN_IDS.POLYGON]: 'polygon',
  [CHAIN_IDS.ARBITRUM]: 'arbitrum',
  [CHAIN_IDS.ETHEREUM_SEPOLIA]: 'ethereum-sepolia',
  [CHAIN_IDS.BASE_SEPOLIA]: 'base-sepolia',
  [CHAIN_IDS.POLYGON_AMOY]: 'polygon-amoy',
  [CHAIN_IDS.ARBITRUM_SEPOLIA]: 'arbitrum-sepolia',
  [CHAIN_IDS.LOCAL]: 'local',
} as const;

/**
 * Network references mapped to CAIP-2 identifiers
 */
export const NETWORK_REFERENCES: Record<EVMNetworkId, NetworkReference> = {
  'eip155:1': 'ethereum',
  'eip155:8453': 'base',
  'eip155:137': 'polygon',
  'eip155:42161': 'arbitrum',
  'eip155:11155111': 'ethereum-sepolia',
  'eip155:84532': 'base-sepolia',
  'eip155:80002': 'polygon-amoy',
  'eip155:421614': 'arbitrum-sepolia',
  'eip155:31337': 'local',
} as const;

/**
 * Default RPC URLs for EVM networks (keyed by CAIP-2 identifier)
 */
export const DEFAULT_RPC_URLS: Record<EVMNetworkId, string> = {
  // Mainnets
  'eip155:1': 'https://eth.llamarpc.com',
  'eip155:8453': 'https://mainnet.base.org',
  'eip155:137': 'https://polygon-rpc.com',
  'eip155:42161': 'https://arb1.arbitrum.io/rpc',
  // Testnets
  'eip155:11155111': 'https://rpc.sepolia.org',
  'eip155:84532': 'https://sepolia.base.org',
  'eip155:80002': 'https://rpc-amoy.polygon.technology',
  'eip155:421614': 'https://sepolia-rollup.arbitrum.io/rpc',
  // Local
  'eip155:31337': 'http://localhost:8545',
} as const;

/**
 * Block explorer URLs (keyed by CAIP-2 identifier)
 */
export const EXPLORER_URLS: Record<EVMNetworkId, string | null> = {
  // Mainnets
  'eip155:1': 'https://etherscan.io',
  'eip155:8453': 'https://basescan.org',
  'eip155:137': 'https://polygonscan.com',
  'eip155:42161': 'https://arbiscan.io',
  // Testnets
  'eip155:11155111': 'https://sepolia.etherscan.io',
  'eip155:84532': 'https://sepolia.basescan.org',
  'eip155:80002': 'https://amoy.polygonscan.com',
  'eip155:421614': 'https://sepolia.arbiscan.io',
  // Local
  'eip155:31337': null,
} as const;

/**
 * Network display names (keyed by CAIP-2 identifier)
 */
export const NETWORK_NAMES: Record<EVMNetworkId, string> = {
  // Mainnets
  'eip155:1': 'Ethereum Mainnet',
  'eip155:8453': 'Base',
  'eip155:137': 'Polygon',
  'eip155:42161': 'Arbitrum One',
  // Testnets
  'eip155:11155111': 'Ethereum Sepolia',
  'eip155:84532': 'Base Sepolia',
  'eip155:80002': 'Polygon Amoy',
  'eip155:421614': 'Arbitrum Sepolia',
  // Local
  'eip155:31337': 'Local (Hardhat/Anvil)',
} as const;

/**
 * Network types (keyed by CAIP-2 identifier)
 */
export const NETWORK_TYPES: Record<EVMNetworkId, NetworkType> = {
  'eip155:1': 'mainnet',
  'eip155:8453': 'mainnet',
  'eip155:137': 'mainnet',
  'eip155:42161': 'mainnet',
  'eip155:11155111': 'testnet',
  'eip155:84532': 'testnet',
  'eip155:80002': 'testnet',
  'eip155:421614': 'testnet',
  'eip155:31337': 'local',
} as const;

/**
 * Native currency symbols (keyed by CAIP-2 identifier)
 */
export const NATIVE_CURRENCIES: Record<
  EVMNetworkId,
  { name: string; symbol: string; decimals: number }
> = {
  'eip155:1': { name: 'Ether', symbol: 'ETH', decimals: 18 },
  'eip155:8453': { name: 'Ether', symbol: 'ETH', decimals: 18 },
  'eip155:137': { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  'eip155:42161': { name: 'Ether', symbol: 'ETH', decimals: 18 },
  'eip155:11155111': { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  'eip155:84532': { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  'eip155:80002': { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
  'eip155:421614': { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  'eip155:31337': { name: 'Ether', symbol: 'ETH', decimals: 18 },
} as const;

/**
 * Complete network configurations (keyed by CAIP-2 identifier)
 */
export const NETWORK_CONFIGS: Record<EVMNetworkId, NetworkConfig> = {
  // Ethereum Mainnet
  'eip155:1': {
    network: 'eip155:1',
    chainId: CHAIN_IDS.ETHEREUM,
    rpcUrl: DEFAULT_RPC_URLS['eip155:1'],
    explorerUrl: EXPLORER_URLS['eip155:1'],
    name: NETWORK_NAMES['eip155:1'],
    type: 'mainnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:1'],
  },
  // Base Mainnet
  'eip155:8453': {
    network: 'eip155:8453',
    chainId: CHAIN_IDS.BASE,
    rpcUrl: DEFAULT_RPC_URLS['eip155:8453'],
    explorerUrl: EXPLORER_URLS['eip155:8453'],
    name: NETWORK_NAMES['eip155:8453'],
    type: 'mainnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:8453'],
  },
  // Polygon Mainnet
  'eip155:137': {
    network: 'eip155:137',
    chainId: CHAIN_IDS.POLYGON,
    rpcUrl: DEFAULT_RPC_URLS['eip155:137'],
    explorerUrl: EXPLORER_URLS['eip155:137'],
    name: NETWORK_NAMES['eip155:137'],
    type: 'mainnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:137'],
  },
  // Arbitrum One
  'eip155:42161': {
    network: 'eip155:42161',
    chainId: CHAIN_IDS.ARBITRUM,
    rpcUrl: DEFAULT_RPC_URLS['eip155:42161'],
    explorerUrl: EXPLORER_URLS['eip155:42161'],
    name: NETWORK_NAMES['eip155:42161'],
    type: 'mainnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:42161'],
  },
  // Ethereum Sepolia
  'eip155:11155111': {
    network: 'eip155:11155111',
    chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
    rpcUrl: DEFAULT_RPC_URLS['eip155:11155111'],
    explorerUrl: EXPLORER_URLS['eip155:11155111'],
    name: NETWORK_NAMES['eip155:11155111'],
    type: 'testnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:11155111'],
  },
  // Base Sepolia
  'eip155:84532': {
    network: 'eip155:84532',
    chainId: CHAIN_IDS.BASE_SEPOLIA,
    rpcUrl: DEFAULT_RPC_URLS['eip155:84532'],
    explorerUrl: EXPLORER_URLS['eip155:84532'],
    name: NETWORK_NAMES['eip155:84532'],
    type: 'testnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:84532'],
  },
  // Polygon Amoy
  'eip155:80002': {
    network: 'eip155:80002',
    chainId: CHAIN_IDS.POLYGON_AMOY,
    rpcUrl: DEFAULT_RPC_URLS['eip155:80002'],
    explorerUrl: EXPLORER_URLS['eip155:80002'],
    name: NETWORK_NAMES['eip155:80002'],
    type: 'testnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:80002'],
  },
  // Arbitrum Sepolia
  'eip155:421614': {
    network: 'eip155:421614',
    chainId: CHAIN_IDS.ARBITRUM_SEPOLIA,
    rpcUrl: DEFAULT_RPC_URLS['eip155:421614'],
    explorerUrl: EXPLORER_URLS['eip155:421614'],
    name: NETWORK_NAMES['eip155:421614'],
    type: 'testnet',
    nativeCurrency: NATIVE_CURRENCIES['eip155:421614'],
  },
  // Local (Hardhat/Anvil)
  'eip155:31337': {
    network: 'eip155:31337',
    chainId: CHAIN_IDS.LOCAL,
    rpcUrl: DEFAULT_RPC_URLS['eip155:31337'],
    explorerUrl: EXPLORER_URLS['eip155:31337'],
    name: NETWORK_NAMES['eip155:31337'],
    type: 'local',
    nativeCurrency: NATIVE_CURRENCIES['eip155:31337'],
  },
};

/**
 * Default provider timeout in milliseconds
 */
export const DEFAULT_PROVIDER_TIMEOUT = 30000;

/**
 * Default number of retry attempts for RPC calls
 */
export const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Default backoff multiplier for retries
 */
export const DEFAULT_BACKOFF_MULTIPLIER = 2;

/**
 * Default block confirmations for transaction finality
 */
export const DEFAULT_CONFIRMATIONS: Record<EVMNetworkId, number> = {
  'eip155:1': 12, // Ethereum - ~2.4 minutes
  'eip155:8453': 1, // Base - instant finality (L2)
  'eip155:137': 128, // Polygon - ~4 minutes
  'eip155:42161': 1, // Arbitrum - instant finality (L2)
  'eip155:11155111': 3, // Ethereum Sepolia
  'eip155:84532': 1, // Base Sepolia
  'eip155:80002': 3, // Polygon Amoy
  'eip155:421614': 1, // Arbitrum Sepolia
  'eip155:31337': 1, // Local
} as const;
