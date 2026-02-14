/**
 * Chainlink utilities for price feeds and data feeds
 */

import type { PublicClient, Chain, HttpTransport } from 'viem';
import type { EVMNetworkId } from '../types/index.js';

/**
 * Chainlink Price Feed ABI (minimal)
 */
export const CHAINLINK_PRICE_FEED_ABI = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'description',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

/**
 * Chainlink Price Feed addresses by network and pair
 * @see https://docs.chain.link/data-feeds/price-feeds/addresses
 */
export const PRICE_FEED_ADDRESSES: Record<
  EVMNetworkId,
  Record<string, `0x${string}`>
> = {
  // Ethereum Mainnet
  'eip155:1': {
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
  },
  // Base
  'eip155:8453': {
    'ETH/USD': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
    'USDC/USD': '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
    'LINK/USD': '0x17CAb8FE31E32f08326e5E27412894e49B0f9D65',
  },
  // Polygon
  'eip155:137': {
    'ETH/USD': '0xF9680D99D6C9589e2a93a78A04A279e509205945',
    'MATIC/USD': '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0',
    'USDC/USD': '0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7',
    'LINK/USD': '0xd9FFdb71EbE7496cC440152d43986Aae0AB76665',
  },
  // Arbitrum One
  'eip155:42161': {
    'ETH/USD': '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    'USDC/USD': '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
    'LINK/USD': '0x86E53CF1B870786351Da77A57575e79CB55812CB',
  },
  // Ethereum Sepolia
  'eip155:11155111': {
    'ETH/USD': '0x694AA1769357215DE4FAC081bf1f309aDC325306',
    'USDC/USD': '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
    'LINK/USD': '0xc59E3633BAAC79493d908e63626716e204A45EdF',
  },
  // Base Sepolia
  'eip155:84532': {
    'ETH/USD': '0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1',
  },
  // Polygon Amoy
  'eip155:80002': {
    'MATIC/USD': '0x001382149eBa3441043c1c66972b4772963f5D43',
  },
  // Arbitrum Sepolia
  'eip155:421614': {
    'ETH/USD': '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
  },
  // Local (no feeds available)
  'eip155:31337': {},
};

/**
 * Price feed result
 */
export interface PriceFeedResult {
  /** Price in USD (scaled by feed decimals) */
  price: bigint;
  /** Feed decimals (usually 8) */
  decimals: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Round ID */
  roundId: bigint;
}

/**
 * Get the latest price from a Chainlink price feed
 *
 * @param client - Viem public client
 * @param feedAddress - Price feed contract address
 * @returns Price feed result
 *
 * @example
 * ```typescript
 * const result = await getLatestPrice(client, PRICE_FEED_ADDRESSES['eip155:8453']['ETH/USD']);
 * const priceUsd = Number(result.price) / Math.pow(10, result.decimals);
 * console.log(`ETH price: $${priceUsd}`);
 * ```
 */
export async function getLatestPrice(
  client: PublicClient<HttpTransport, Chain>,
  feedAddress: `0x${string}`
): Promise<PriceFeedResult> {
  const [latestRoundData, decimals] = await Promise.all([
    client.readContract({
      address: feedAddress,
      abi: CHAINLINK_PRICE_FEED_ABI,
      functionName: 'latestRoundData',
    }),
    client.readContract({
      address: feedAddress,
      abi: CHAINLINK_PRICE_FEED_ABI,
      functionName: 'decimals',
    }),
  ]);

  const [roundId, answer, , updatedAt] = latestRoundData as [
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return {
    price: answer,
    decimals: Number(decimals),
    updatedAt: Number(updatedAt),
    roundId,
  };
}

/**
 * Get price feed address for a trading pair on a network
 *
 * @param network - Network identifier
 * @param pair - Trading pair (e.g., "ETH/USD")
 * @returns Price feed address or undefined if not available
 */
export function getPriceFeedAddress(
  network: EVMNetworkId,
  pair: string
): `0x${string}` | undefined {
  return PRICE_FEED_ADDRESSES[network]?.[pair];
}

/**
 * Check if a price feed is available for a trading pair on a network
 *
 * @param network - Network identifier
 * @param pair - Trading pair (e.g., "ETH/USD")
 * @returns True if price feed is available
 */
export function hasPriceFeed(network: EVMNetworkId, pair: string): boolean {
  return getPriceFeedAddress(network, pair) !== undefined;
}

/**
 * Get available price feeds for a network
 *
 * @param network - Network identifier
 * @returns Array of available trading pairs
 */
export function getAvailablePriceFeeds(network: EVMNetworkId): string[] {
  const feeds = PRICE_FEED_ADDRESSES[network];
  return feeds ? Object.keys(feeds) : [];
}

/**
 * Convert USD amount to token amount using Chainlink price feed
 *
 * @param client - Viem public client
 * @param network - Network identifier
 * @param usdAmount - Amount in USD (e.g., 1.00 for $1)
 * @param tokenSymbol - Token symbol (ETH, LINK, etc.)
 * @param tokenDecimals - Token decimals (18 for ETH, 18 for LINK)
 * @returns Amount in token's smallest unit (wei for ETH)
 *
 * @example
 * ```typescript
 * // Convert $10 USD to ETH wei
 * const ethWei = await usdToToken(client, 'eip155:8453', 10.0, 'ETH', 18);
 * console.log(`$10 = ${formatEther(ethWei)} ETH`);
 * ```
 */
export async function usdToToken(
  client: PublicClient<HttpTransport, Chain>,
  network: EVMNetworkId,
  usdAmount: number,
  tokenSymbol: string,
  tokenDecimals: number
): Promise<bigint> {
  const pair = `${tokenSymbol}/USD`;
  const feedAddress = getPriceFeedAddress(network, pair);

  if (!feedAddress) {
    throw new Error(
      `Price feed not available for ${pair} on network ${network}`
    );
  }

  const priceResult = await getLatestPrice(client, feedAddress);

  // Calculate: tokenAmount = usdAmount / priceUsd
  // Price is in USD with `priceResult.decimals` decimals
  // We want result in token's atomic units

  // usdAmount * 10^tokenDecimals * 10^priceDecimals / price
  const usdScaled = BigInt(
    Math.round(usdAmount * Math.pow(10, priceResult.decimals))
  );
  const tokenMultiplier = 10n ** BigInt(tokenDecimals);
  const tokenAmount = (usdScaled * tokenMultiplier) / priceResult.price;

  return tokenAmount;
}

/**
 * Convert token amount to USD using Chainlink price feed
 *
 * @param client - Viem public client
 * @param network - Network identifier
 * @param tokenAmount - Amount in token's smallest unit
 * @param tokenSymbol - Token symbol (ETH, LINK, etc.)
 * @param tokenDecimals - Token decimals
 * @returns Amount in USD
 *
 * @example
 * ```typescript
 * // Convert 1 ETH to USD
 * const usd = await tokenToUsd(client, 'eip155:8453', parseEther('1'), 'ETH', 18);
 * console.log(`1 ETH = $${usd}`);
 * ```
 */
export async function tokenToUsd(
  client: PublicClient<HttpTransport, Chain>,
  network: EVMNetworkId,
  tokenAmount: bigint,
  tokenSymbol: string,
  tokenDecimals: number
): Promise<number> {
  const pair = `${tokenSymbol}/USD`;
  const feedAddress = getPriceFeedAddress(network, pair);

  if (!feedAddress) {
    throw new Error(
      `Price feed not available for ${pair} on network ${network}`
    );
  }

  const priceResult = await getLatestPrice(client, feedAddress);

  // Calculate: usdAmount = tokenAmount * priceUsd / 10^tokenDecimals
  const tokenMultiplier = 10n ** BigInt(tokenDecimals);
  const priceMultiplier = 10n ** BigInt(priceResult.decimals);

  const usdScaled = (tokenAmount * priceResult.price) / tokenMultiplier;
  const usdAmount = Number(usdScaled) / Number(priceMultiplier);

  return usdAmount;
}

/**
 * Check if price data is stale (older than maxAge)
 *
 * @param updatedAt - Last update timestamp
 * @param maxAge - Maximum age in seconds (default: 3600 = 1 hour)
 * @returns True if price data is stale
 */
export function isPriceStale(updatedAt: number, maxAge = 3600): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - updatedAt > maxAge;
}
