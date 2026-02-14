/**
 * Provider utilities for EVM chains using viem
 */

import type {
  PublicClient,
  WalletClient,
  Transport,
  Chain,
  Account,
  HttpTransport,
} from 'viem';
import { createPublicClient, createWalletClient, http } from 'viem';
import {
  mainnet,
  base,
  polygon,
  arbitrum,
  sepolia,
  baseSepolia,
  polygonAmoy,
  arbitrumSepolia,
  hardhat,
} from 'viem/chains';
import type { EVMNetworkId, ProviderOptions } from '../types/index.js';
import { getNetworkConfig, validateNetwork } from '../networks/index.js';
import { err, wrapUnknown } from '../errors.js';

/**
 * Chain configurations mapping
 */
const VIEM_CHAINS: Record<EVMNetworkId, Chain> = {
  'eip155:1': mainnet,
  'eip155:8453': base,
  'eip155:137': polygon,
  'eip155:42161': arbitrum,
  'eip155:11155111': sepolia,
  'eip155:84532': baseSepolia,
  'eip155:80002': polygonAmoy,
  'eip155:421614': arbitrumSepolia,
  'eip155:31337': hardhat,
};

/**
 * Get viem chain configuration for a network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @returns Viem chain configuration
 */
export function getViemChain(network: EVMNetworkId): Chain {
  const chain = VIEM_CHAINS[network];
  if (!chain) {
    throw err.notFound(`Chain configuration for network ${network}`);
  }
  return chain;
}

/**
 * Create a public client for reading from the blockchain
 *
 * @param networkOrOptions - Network identifier (CAIP-2 format) or ProviderOptions object
 * @param options - Optional provider options (only used if first argument is a network string)
 * @returns Configured public client
 *
 * @example
 * ```typescript
 * // Simple usage with default RPC
 * const client = createPublicClient('eip155:8453');
 *
 * // With custom RPC URL
 * const client = createPublicClient('eip155:1', {
 *   rpcUrl: 'https://your-rpc-endpoint.com',
 * });
 *
 * // Using ProviderOptions object
 * const client = createPublicClient({
 *   network: 'eip155:8453',
 *   rpcUrl: 'https://custom-rpc.com',
 *   timeout: 60000,
 * });
 * ```
 */
export function createProvider(
  networkOrOptions: string | ProviderOptions,
  options?: Omit<ProviderOptions, 'network'>
): PublicClient<HttpTransport, Chain> {
  // Handle ProviderOptions object
  if (typeof networkOrOptions === 'object') {
    const opts = networkOrOptions;
    const validatedNetwork = validateNetwork(opts.network);
    const config = getNetworkConfig(validatedNetwork);
    const rpcUrl = opts.rpcUrl ?? config.rpcUrl;
    const chain = getViemChain(validatedNetwork);

    return createPublicClient({
      chain,
      transport: http(rpcUrl, {
        timeout: opts.timeout,
        retryCount: opts.retries ?? 3,
      }),
    });
  }

  // Handle network string with optional options
  const validatedNetwork = validateNetwork(networkOrOptions);
  const config = getNetworkConfig(validatedNetwork);
  const rpcUrl = options?.rpcUrl ?? config.rpcUrl;
  const chain = getViemChain(validatedNetwork);

  return createPublicClient({
    chain,
    transport: http(rpcUrl, {
      timeout: options?.timeout,
      retryCount: options?.retries ?? 3,
    }),
  });
}

/**
 * Create a wallet client for signing and sending transactions
 *
 * @param network - Network identifier (CAIP-2 format)
 * @param account - Account for signing
 * @param rpcUrl - Optional custom RPC URL
 * @returns Configured wallet client
 *
 * @example
 * ```typescript
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount('0x...');
 * const walletClient = createWalletProvider('eip155:8453', account);
 * ```
 */
export function createWalletProvider(
  network: EVMNetworkId,
  account: Account,
  rpcUrl?: string
): WalletClient<Transport, Chain, Account> {
  const validatedNetwork = validateNetwork(network);
  const config = getNetworkConfig(validatedNetwork);
  const url = rpcUrl ?? config.rpcUrl;
  const chain = getViemChain(validatedNetwork);

  return createWalletClient({
    account,
    chain,
    transport: http(url),
  }) as WalletClient<Transport, Chain, Account>;
}

/**
 * Get the chain ID for a network
 *
 * @param network - Network identifier (CAIP-2 format)
 * @returns Numeric chain ID
 *
 * @example
 * ```typescript
 * const chainId = getChainId('eip155:8453');
 * console.log(chainId); // 8453
 * ```
 */
export function getChainId(network: string): number {
  const validatedNetwork = validateNetwork(network);
  const config = getNetworkConfig(validatedNetwork);
  return config.chainId;
}

/**
 * Retry an RPC call with exponential backoff
 *
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param baseDelay - Base delay in milliseconds
 * @returns Result of the function
 */
export async function retryRpcCall<T>(
  function_: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < maxRetries; index++) {
    try {
      return await function_();
    } catch (error) {
      lastError = error;
      if (index < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, index);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError
    ? wrapUnknown(lastError, 'ENETWORK', 'RPC call failed after all retries')
    : err.network('RPC call failed after all retries');
}

/**
 * Check if a network is reachable
 *
 * @param network - Network identifier
 * @param rpcUrl - Optional custom RPC URL
 * @returns True if the network is reachable
 */
export async function isNetworkReachable(
  network: EVMNetworkId,
  rpcUrl?: string
): Promise<boolean> {
  try {
    const client = createProvider(network, { rpcUrl });
    await client.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the current block number for a network
 *
 * @param network - Network identifier
 * @param rpcUrl - Optional custom RPC URL
 * @returns Current block number
 */
export async function getBlockNumber(
  network: EVMNetworkId,
  rpcUrl?: string
): Promise<bigint> {
  const client = createProvider(network, { rpcUrl });
  return client.getBlockNumber();
}

/**
 * Get the native balance of an address
 *
 * @param network - Network identifier
 * @param address - Address to check
 * @param rpcUrl - Optional custom RPC URL
 * @returns Balance in wei
 */
export async function getNativeBalance(
  network: EVMNetworkId,
  address: `0x${string}`,
  rpcUrl?: string
): Promise<bigint> {
  const client = createProvider(network, { rpcUrl });
  return client.getBalance({ address });
}

// Re-export viem chain utilities
export { VIEM_CHAINS };
