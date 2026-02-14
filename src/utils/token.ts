/**
 * Token utilities for ERC20 interactions on EVM chains
 */

import type { PublicClient, Chain, HttpTransport } from 'viem';
import { formatUnits, parseUnits } from 'viem';
import { ERC20_ABI } from '../tokens/index.js';

/**
 * Get ERC20 token balance
 *
 * @param client - Viem public client
 * @param tokenAddress - Token contract address
 * @param accountAddress - Account to check balance for
 * @returns Balance as string (wei/atomic units)
 *
 * @example
 * ```typescript
 * const balance = await getTokenBalance(
 *   client,
 *   '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *   '0x1234...'
 * );
 * console.log('Balance:', balance);
 * ```
 */
export async function getTokenBalance(
  client: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  accountAddress: `0x${string}`
): Promise<string> {
  const balance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [accountAddress],
  });

  return (balance as bigint).toString();
}

/**
 * Get ERC20 token allowance
 *
 * @param client - Viem public client
 * @param tokenAddress - Token contract address
 * @param ownerAddress - Token owner address
 * @param spenderAddress - Spender address to check allowance for
 * @returns Allowance as string (atomic units)
 */
export async function getTokenAllowance(
  client: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
  spenderAddress: `0x${string}`
): Promise<string> {
  const allowance = await client.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [ownerAddress, spenderAddress],
  });

  return (allowance as bigint).toString();
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * Get ERC20 token metadata
 *
 * @param client - Viem public client
 * @param tokenAddress - Token contract address
 * @returns Token metadata
 *
 * @example
 * ```typescript
 * const metadata = await getTokenMetadata(client, usdcAddress);
 * console.log(`${metadata.name} (${metadata.symbol})`);
 * ```
 */
export async function getTokenMetadata(
  client: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`
): Promise<TokenMetadata> {
  const [symbol, decimals] = await Promise.all([
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'symbol',
    }),
    client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    }),
  ]);

  return {
    name: symbol as string, // Name often equals symbol for standard tokens
    symbol: symbol as string,
    decimals: Number(decimals),
  };
}

/**
 * Format token amount from atomic units to human-readable
 *
 * @param amount - Amount in atomic units (wei)
 * @param decimals - Token decimals
 * @returns Formatted amount string
 */
export function formatTokenAmount(
  amount: bigint | string,
  decimals: number
): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  return formatUnits(value, decimals);
}

/**
 * Parse token amount from human-readable to atomic units
 *
 * @param amount - Human-readable amount
 * @param decimals - Token decimals
 * @returns Amount in atomic units (wei)
 */
export function parseTokenAmount(amount: string, decimals: number): bigint {
  return parseUnits(amount, decimals);
}

/**
 * Check if an address has sufficient token balance
 *
 * @param client - Viem public client
 * @param tokenAddress - Token contract address
 * @param accountAddress - Account to check
 * @param requiredAmount - Required amount in atomic units
 * @returns True if balance is sufficient
 */
export async function hasSufficientBalance(
  client: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  accountAddress: `0x${string}`,
  requiredAmount: string
): Promise<boolean> {
  const balance = await getTokenBalance(client, tokenAddress, accountAddress);
  return BigInt(balance) >= BigInt(requiredAmount);
}

/**
 * Check if spender has sufficient allowance
 *
 * @param client - Viem public client
 * @param tokenAddress - Token contract address
 * @param ownerAddress - Token owner
 * @param spenderAddress - Spender address
 * @param requiredAmount - Required amount in atomic units
 * @returns True if allowance is sufficient
 */
export async function hasSufficientAllowance(
  client: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  requiredAmount: string
): Promise<boolean> {
  const allowance = await getTokenAllowance(
    client,
    tokenAddress,
    ownerAddress,
    spenderAddress
  );
  return BigInt(allowance) >= BigInt(requiredAmount);
}
