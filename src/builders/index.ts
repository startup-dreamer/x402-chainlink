/**
 * Payment builder utilities
 * Convenient helpers for constructing payment requirements
 * @module builders
 */

import type { PaymentRequirements } from '../types/payment.js';
import type { EVMNetworkId } from '../types/network.js';
import {
  getTokenAddress,
  toAtomicUnits,
  isTokenAvailable,
  type TokenSymbol,
} from '../tokens/index.js';
import { err } from '../errors.js';

/**
 * Parameters for building payment requirements
 */
export interface PaymentRequirementsParams {
  /** Target network (CAIP-2 format) */
  network: EVMNetworkId;
  /** Payment amount in human-readable units (e.g., 1.50 for $1.50 USDC) */
  amount: number;
  /** Token symbol (USDC, LINK) or contract address */
  asset: string;
  /** Recipient address */
  payTo: `0x${string}`;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number | undefined;
  /** CRE contract address for settlement */
  creContract?: `0x${string}` | undefined;
  /** Extra metadata to include */
  extra?: {
    /** Token name (auto-filled for known tokens) */
    name?: string;
    /** Token symbol (auto-filled for known tokens) */
    symbol?: string;
    /** Token decimals (auto-filled for known tokens) */
    decimals?: number;
    /** CRE contract address */
    creContract?: `0x${string}`;
  };
}

/**
 * Check if a string is a known token symbol
 */
function isTokenSymbol(value: string): value is TokenSymbol {
  return value === 'USDC' || value === 'LINK';
}

/**
 * Get token metadata for known tokens
 */
function getTokenMetadata(symbol: TokenSymbol): {
  name: string;
  symbol: string;
  decimals: number;
} {
  switch (symbol) {
    case 'USDC':
      return { name: 'USD Coin', symbol: 'USDC', decimals: 6 };
    case 'LINK':
      return { name: 'Chainlink', symbol: 'LINK', decimals: 18 };
  }
}

/**
 * Build a PaymentRequirements object
 *
 * @param params - Payment requirement parameters
 * @returns Fully-formed PaymentRequirements object
 * @throws Error if token is not available on the network
 *
 * @example
 * ```typescript
 * // Using a known token symbol
 * const requirements = buildPaymentRequirements({
 *   network: 'eip155:8453',
 *   amount: 1.50,  // $1.50 USDC
 *   asset: 'USDC',
 *   payTo: '0x1234...',
 * });
 *
 * // Using a custom token address
 * const requirements = buildPaymentRequirements({
 *   network: 'eip155:1',
 *   amount: 1000000,  // Amount in atomic units
 *   asset: '0xCustomTokenAddress...',
 *   payTo: '0x1234...',
 *   extra: {
 *     name: 'Custom Token',
 *     symbol: 'CTK',
 *     decimals: 18,
 *   },
 * });
 * ```
 */
export function buildPaymentRequirements(
  params: PaymentRequirementsParams
): PaymentRequirements {
  let assetAddress: `0x${string}` | null;
  let atomicAmount: string;
  let extra = params.extra;

  if (isTokenSymbol(params.asset)) {
    // Known token - resolve address and convert amount
    if (!isTokenAvailable(params.asset, params.network)) {
      throw err.invalid(
        `Token ${params.asset} is not available on ${params.network}`,
        { token: params.asset, network: params.network }
      );
    }

    const address = getTokenAddress(params.asset, params.network);
    if (!address) {
      throw err.invalid(
        `Token ${params.asset} address not found on ${params.network}`,
        { token: params.asset, network: params.network }
      );
    }
    
    assetAddress = address as `0x${string}`;
    atomicAmount = toAtomicUnits(params.amount, params.asset);

    // Auto-populate token metadata if not provided
    const metadata = getTokenMetadata(params.asset);
    extra = {
      name: params.extra?.name ?? metadata.name,
      symbol: params.extra?.symbol ?? metadata.symbol,
      decimals: params.extra?.decimals ?? metadata.decimals,
      ...(params.creContract && { creContract: params.creContract }),
      ...(params.extra?.creContract && {
        creContract: params.extra.creContract,
      }),
    };
  } else {
    // Custom token address - use amount as-is (assume already in atomic units)
    assetAddress = params.asset as `0x${string}`;
    atomicAmount = String(params.amount);
  }

  return {
    scheme: 'exact',
    network: params.network,
    amount: atomicAmount,
    asset: assetAddress,
    payTo: params.payTo,
    maxTimeoutSeconds: params.maxTimeoutSeconds ?? 300,
    ...(extra && { extra }),
  };
}

/**
 * Parameters for USDC payment requirements
 */
export interface USDCPaymentParams {
  /** Target network (CAIP-2 format) */
  network: EVMNetworkId;
  /** Amount in USD (e.g., 1.50 for $1.50) */
  amount: number;
  /** Recipient address */
  payTo: `0x${string}`;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
  /** CRE contract address */
  creContract?: `0x${string}`;
}

/**
 * Build payment requirements for USDC
 *
 * @param params - USDC payment parameters
 * @returns PaymentRequirements for USDC payment
 * @throws Error if USDC is not available on the specified network
 *
 * @example
 * ```typescript
 * const requirements = buildUSDCPayment({
 *   network: 'eip155:8453',
 *   amount: 1.50,  // $1.50 USDC
 *   payTo: '0x1234...',
 * });
 * ```
 */
export function buildUSDCPayment(
  params: USDCPaymentParams
): PaymentRequirements {
  return buildPaymentRequirements({
    network: params.network,
    amount: params.amount,
    asset: 'USDC',
    payTo: params.payTo,
    creContract: params.creContract,
    ...(params.maxTimeoutSeconds !== undefined && {
      maxTimeoutSeconds: params.maxTimeoutSeconds,
    }),
  });
}

/**
 * Parameters for LINK payment requirements
 */
export interface LINKPaymentParams {
  /** Target network (CAIP-2 format) */
  network: EVMNetworkId;
  /** Amount in LINK (e.g., 1.0 for 1 LINK) */
  amount: number;
  /** Recipient address */
  payTo: `0x${string}`;
  /** Maximum timeout in seconds (default: 300) */
  maxTimeoutSeconds?: number;
  /** CRE contract address */
  creContract?: `0x${string}`;
}

/**
 * Build payment requirements for LINK
 *
 * @param params - LINK payment parameters
 * @returns PaymentRequirements for LINK payment
 *
 * @example
 * ```typescript
 * const requirements = buildLINKPayment({
 *   network: 'eip155:1',
 *   amount: 10,  // 10 LINK
 *   payTo: '0x1234...',
 * });
 * ```
 */
export function buildLINKPayment(
  params: LINKPaymentParams
): PaymentRequirements {
  return buildPaymentRequirements({
    network: params.network,
    amount: params.amount,
    asset: 'LINK',
    payTo: params.payTo,
    creContract: params.creContract,
    ...(params.maxTimeoutSeconds !== undefined && {
      maxTimeoutSeconds: params.maxTimeoutSeconds,
    }),
  });
}
