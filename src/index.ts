/**
 * Chainlink CRE x402 Payment Protocol Library
 *
 * A pure library providing core functionality for implementing
 * the x402 payment protocol on EVM chains using Chainlink CRE.
 *
 * Spec compliance: x402 v2
 *
 * @module x402-chainlink
 */

export * from './payment/index.js';
export * from './networks/index.js';
export * from './tokens/index.js';
export * from './utils/chainlink.js';
/**
 * Supported x402 protocol version
 */
export const X402_VERSION = 2;
export * from './cre/index.js';
export * from './utils/provider.js';
export * from './utils/token.js';
export * from './utils/encoding.js';
export * from './builders/index.js';
export type {
  EVMNetworkId,
  NetworkConfig,
  NativeCurrency,
  ProviderOptions,
  AccountConfig,
} from './types/network.js';
export type * from './types/payment.js';
export * from './types/payment.js';
export type * from './types/settlement.js';
export type {
  CREConfig,
  CREWorkflowMetadata,
  CRESimulationResult,
  CREEvmReadRequest,
  CREEvmWriteRequest,
  CREHttpRequest,
  CRECapability,
} from './types/cre.js';
export type * from './facilitator/client.js';
export type * from './types/discovery.js';
export type * from './extensions/types.js';
export * from './facilitator/index.js';
export * from './discovery/index.js';
export * from './extensions/index.js';
export * from './types/schemas.js';
export * from './errors.js';
export * from './contracts/deployments.js';
