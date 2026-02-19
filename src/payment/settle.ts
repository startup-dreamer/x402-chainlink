/**
 * Payment settlement functions using Chainlink CRE
 */

import type { PublicClient, Chain, HttpTransport } from 'viem';
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  EVMNetworkId,
} from '../types/index.js';
import type { CREClientConfig } from '../cre/types.js';
import { verifyPayment } from './verify.js';
import { createCREClient, createCREClientForNetwork } from '../cre/index.js';
import { wrapUnknown } from '../errors.js';

/**
 * Settlement options
 */
export interface SettlementOptions {
  /** CRE client configuration */
  creConfig?: CREClientConfig;
  /** Use simulation mode (for testing) */
  simulation?: boolean;
  /** Skip verification before settlement */
  skipVerification?: boolean;
}

/**
 * Settle payment by executing via Chainlink CRE
 *
 * @param client - Viem public client for verification
 * @param payload - Payment payload from client
 * @param paymentRequirements - Payment requirements from server
 * @param options - Settlement options (CRE config, simulation mode)
 * @returns Settlement result with transaction hash
 *
 * @example
 * ```typescript
 * const result = await settlePayment(
 *   client,
 *   payload,
 *   requirements,
 *   {
 *     creConfig: {
 *       endpoint: 'https://cre.chainlink.io/x402',
 *       network: 'eip155:8453'
 *     }
 *   }
 * );
 *
 * if (result.success) {
 *   console.log('Payment settled:', result.transaction);
 * }
 * ```
 */
export async function settlePayment(
  client: PublicClient<HttpTransport, Chain>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  options?: SettlementOptions
): Promise<SettleResponse> {
  if (!options?.skipVerification) {
    const verification = await verifyPayment(
      client,
      payload,
      paymentRequirements
    );

    if (!verification.isValid) {
      return {
        success: false,
        errorReason: verification.invalidReason,
        transaction: '',
        network: paymentRequirements.network,
        payer: verification.payer,
      };
    }
  }

  try {
    const creClient = options?.creConfig
      ? createCREClient({
          ...options.creConfig,
          simulation: options?.simulation ?? options.creConfig.simulation,
        })
      : createCREClientForNetwork(paymentRequirements.network, {
          simulation: options?.simulation ?? true, // Default to simulation if no config
        });

    // Execute settlement via CRE
    const result = await creClient.settle(payload, paymentRequirements, client);

    return result;
  } catch (error) {
    const wrappedError = wrapUnknown(error);
    const errorMessage =
      error instanceof Error ? error.message : wrappedError.message;

    return {
      success: false,
      errorReason: `cre_workflow_failed: ${errorMessage}`,
      transaction: '',
      network: paymentRequirements.network,
      payer: payload.payload.authorization.from,
    };
  }
}

/**
 * Verify and settle payment in one operation
 *
 * More efficient than calling verify and settle separately
 * as it can use a single CRE workflow execution.
 *
 * @param client - Viem public client
 * @param payload - Payment payload from client
 * @param paymentRequirements - Payment requirements from server
 * @param options - Settlement options
 * @returns Object with both verify and settle responses
 */
export async function verifyAndSettle(
  client: PublicClient<HttpTransport, Chain>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  options?: SettlementOptions
): Promise<{
  verification: Awaited<ReturnType<typeof verifyPayment>>;
  settlement?: SettleResponse | undefined;
}> {
  try {
    // Create CRE client
    const creClient = options?.creConfig
      ? createCREClient({
          ...options.creConfig,
          simulation: options?.simulation ?? options.creConfig.simulation,
        })
      : createCREClientForNetwork(paymentRequirements.network, {
          simulation: options?.simulation ?? true,
        });

    // Execute combined verify and settle
    const result = await creClient.verifyAndSettle(
      payload,
      paymentRequirements,
      client
    );

    return {
      verification: result.verifyResponse,
      settlement: result.settleResponse,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      verification: {
        isValid: false,
        invalidReason: 'cre_workflow_failed',
        details: { error: errorMessage },
      },
    };
  }
}

/**
 * Wait for settlement transaction to be confirmed
 *
 * @param client - Viem public client
 * @param transactionHash - Transaction hash to wait for
 * @param options - Wait options
 * @returns Transaction receipt details
 */
export async function waitForSettlement(
  client: PublicClient<HttpTransport, Chain>,
  transactionHash: `0x${string}`,
  options?: {
    confirmations?: number;
    timeout?: number;
  }
): Promise<{
  blockNumber: number;
  blockHash: `0x${string}`;
  status: 'confirmed' | 'failed';
}> {
  const receipt = await client.waitForTransactionReceipt({
    hash: transactionHash,
    confirmations: options?.confirmations ?? 1,
    timeout: options?.timeout ?? 60_000,
  });

  return {
    blockNumber: Number(receipt.blockNumber),
    blockHash: receipt.blockHash,
    status: receipt.status === 'success' ? 'confirmed' : 'failed',
  };
}

/**
 * Create CRE configuration for a network
 *
 * @param network - Network identifier
 * @param options - Additional options
 * @returns CRE client configuration
 */
export function createCREConfig(
  network: EVMNetworkId,
  options?: {
    apiKey?: string;
    endpoint?: string;
    simulation?: boolean;
    facilitatorAddress?: `0x${string}`;
  }
): CREClientConfig {
  const { DEFAULT_CRE_ENDPOINTS } = require('../cre/types.js');
  const endpointConfig = DEFAULT_CRE_ENDPOINTS[network];

  return {
    endpoint: options?.endpoint ?? endpointConfig?.endpoint ?? '',
    network,
    apiKey: options?.apiKey,
    simulation: options?.simulation ?? false,
    facilitatorAddress:
      options?.facilitatorAddress ??
      endpointConfig?.facilitatorAddress ??
      '0x0000000000000000000000000000000000000000',
  };
}

/**
 * Check if CRE service is available for a network
 *
 * @param network - Network identifier
 * @param endpoint - Optional custom endpoint
 * @returns True if CRE service is available
 */
export async function isCREAvailable(
  network: EVMNetworkId,
  endpoint?: string
): Promise<boolean> {
  try {
    const client = endpoint
      ? createCREClient({
          endpoint,
          network,
          facilitatorAddress: '0x0000000000000000000000000000000000000000',
        })
      : createCREClientForNetwork(network);

    return await client.isAvailable();
  } catch {
    return false;
  }
}
