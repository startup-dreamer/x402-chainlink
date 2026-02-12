/**
 * Payment type definitions for EVM x402
 * Spec compliance: x402 v2
 */

import type { EVMNetworkId } from './network.js';

/**
 * Payment scheme type
 * Currently only "exact" is supported
 */
export type PaymentScheme = 'exact';

/**
 * EIP-712 Signature structure for EVM
 * Standard Ethereum signature format
 */
export interface Signature {
  /** v component of signature (recovery id) */
  v: number;
  /** r component of signature (hex string) */
  r: `0x${string}`;
  /** s component of signature (hex string) */
  s: `0x${string}`;
}

/**
 * Compact signature format (65 bytes hex)
 */
export type CompactSignature = `0x${string}`;

/**
 * EIP-2612 Permit signature data
 * Used for gasless approvals on supported tokens (USDC, DAI, etc.)
 */
export interface PermitData {
  /** Permit deadline (Unix timestamp in seconds as string) */
  deadline: string;
  /** v component of permit signature (recovery id) */
  v: number;
  /** r component of permit signature (hex string) */
  r: `0x${string}`;
  /** s component of permit signature (hex string) */
  s: `0x${string}`;
}

/**
 * Payment authorization structure (EIP-712 typed data)
 */
export interface PaymentAuthorization {
  /** Payer address (0x...) */
  from: `0x${string}`;
  /** Recipient address (0x...) */
  to: `0x${string}`;
  /** Payment amount (uint256 as string) */
  amount: string;
  /** Token contract address */
  token: `0x${string}`;
  /** Nonce for replay protection */
  nonce: string;
  /** Expiry timestamp (Unix timestamp in seconds) */
  validUntil: string;
  /** Chain ID for cross-chain safety */
  chainId: number;
}

// ============================================================================
// x402 v2 Types
// ============================================================================

/**
 * Resource information for protected resources
 * Spec compliance: x402 v2 - ResourceInfo Schema
 */
export interface ResourceInfo {
  /** URL of the protected resource */
  url: string;
  /** Human-readable description of the resource */
  description?: string;
  /** MIME type of the expected response */
  mimeType?: string;
}

/**
 * Extension data structure for protocol extensions
 * Spec compliance: x402 v2 - Extensions System
 */
export interface ExtensionData {
  /** Extension-specific information */
  info: unknown;
  /** JSON Schema defining expected structure */
  schema?: object;
}

/**
 * Payment requirements sent by server (v2)
 * Spec compliance: x402 v2 - PaymentRequirements Schema
 */
export interface PaymentRequirements {
  /** Payment scheme */
  scheme: PaymentScheme;
  /** Network identifier (CAIP-2 format, e.g., "eip155:8453") */
  network: EVMNetworkId;
  /** Required payment amount (uint256 as string, in token's smallest unit) */
  amount: string;
  /** Token contract address */
  asset: `0x${string}`;
  /** Recipient address (0x...) */
  payTo: `0x${string}`;
  /** Maximum timeout in seconds for payment completion */
  maxTimeoutSeconds: number;
  /** Additional scheme-specific data */
  extra?: {
    /** Token name (e.g., "USD Coin") */
    name?: string;
    /** Token symbol (e.g., "USDC") */
    symbol?: string;
    /** Token decimals (e.g., 6 for USDC) */
    decimals?: number;
    /** CRE workflow contract address for settlement */
    creContract?: `0x${string}`;
  };
}

/**
 * Payment required response from server (402 response)
 * Spec compliance: x402 v2 - PaymentRequired Schema
 */
export interface PaymentRequired {
  /** x402 protocol version */
  x402Version: 2;
  /** Human-readable error message explaining why payment is required */
  error?: string;
  /** Information about the protected resource */
  resource: ResourceInfo;
  /** Array of acceptable payment methods */
  accepts: Array<PaymentRequirements>;
  /** Protocol extensions */
  extensions?: Record<string, ExtensionData>;
}

/**
 * Exact scheme payload for EVM (EIP-712 signed)
 * Spec compliance: x402 v2 - scheme_exact_evm
 */
export interface ExactEVMPayload {
  /** EIP-712 signature (compact 65-byte format) */
  signature: CompactSignature;
  /** Authorization details */
  authorization: PaymentAuthorization;
  /** Optional EIP-2612 permit data for gasless approvals */
  permit?: PermitData;
}

/**
 * Payment payload created by client (v2)
 * Spec compliance: x402 v2 - PaymentPayload Schema
 */
export interface PaymentPayload {
  /** x402 protocol version */
  x402Version: 2;
  /** Information about the protected resource (optional, echo from PaymentRequired) */
  resource?: ResourceInfo;
  /** The chosen payment requirement from accepts array */
  accepted: PaymentRequirements;
  /** Scheme-specific payment data */
  payload: ExactEVMPayload;
  /** Protocol extensions */
  extensions?: Record<string, unknown>;
  /** EIP-712 typed data used for signature (for verification) */
  typedData?: EIP712TypedData;
  /** CRE workflow endpoint for settlement (optional) */
  creEndpoint?: string;
}

/**
 * EIP-712 Payment Message
 */
export interface EIP712PaymentMessage {
  from: `0x${string}`;
  to: `0x${string}`;
  amount: bigint;
  token: `0x${string}`;
  nonce: bigint;
  validUntil: bigint;
  chainId: bigint;
  [key: string]: unknown; // Index signature for viem compatibility
}

/**
 * EIP-712 TypedData structure
 */
export interface EIP712TypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

/**
 * Payment requirements selector function type
 */
export type PaymentRequirementsSelector = (
  requirements: Array<PaymentRequirements>
) => Promise<PaymentRequirements> | PaymentRequirements;

/**
 * x402 EIP-712 domain for payment authorization
 */
export const X402_EIP712_DOMAIN = {
  name: 'x402-chainlink',
  version: '1',
} as const;

/**
 * x402 EIP-712 types for payment authorization
 */
export const X402_EIP712_TYPES = {
  PaymentAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'token', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
  ] as Array<{ name: string; type: string }>,
};

// ============================================================================
// EIP-2612 Permit Types
// ============================================================================

/**
 * EIP-2612 Permit message structure
 * Used for signing gasless token approvals
 */
export interface EIP2612PermitMessage {
  /** Token owner address */
  owner: `0x${string}`;
  /** Spender address (typically the X402Facilitator contract) */
  spender: `0x${string}`;
  /** Amount to approve (uint256) */
  value: bigint;
  /** Token's internal nonce for the owner */
  nonce: bigint;
  /** Permit deadline (Unix timestamp) */
  deadline: bigint;
  [key: string]: unknown; // Index signature for viem compatibility
}

/**
 * EIP-2612 Permit domain structure
 * Note: Domain parameters vary by token implementation
 */
export interface PermitDomain {
  /** Token name (e.g., "USD Coin") */
  name: string;
  /** Token version (e.g., "2" for USDC) */
  version: string;
  /** Chain ID */
  chainId: number;
  /** Token contract address */
  verifyingContract: `0x${string}`;
}

/**
 * EIP-2612 Permit typed data types
 */
export const PERMIT_EIP712_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ] as Array<{ name: string; type: string }>,
};

/**
 * Options for creating a payment payload with permit
 */
export interface CreatePaymentWithPermitOptions {
  /** Include EIP-2612 permit for gasless approval */
  includePermit?: boolean;
  /** Custom permit deadline (defaults to validUntil + 1 hour) */
  permitDeadline?: bigint;
  /** X402Facilitator contract address (required for permit) */
  facilitatorAddress?: `0x${string}`;
}
