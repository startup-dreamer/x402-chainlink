/**
 * Schemas for runtime validation
 * Spec compliance: x402 v2
 */

import { z } from 'zod';


/**
 * EVM address validator (checksummed or lowercase)
 */
const evmAddressRegex = /^0x[0-9a-fA-F]{40}$/;

/**
 * Transaction/block hash validator (32 bytes)
 */
const bytes32Regex = /^0x[0-9a-fA-F]{64}$/;

/**
 * Signature validator (65 bytes compact)
 */
const signatureRegex = /^0x[0-9a-fA-F]{130}$/;

/**
 * Schema for EVM network (CAIP-2 format)
 * Spec compliance: x402 v2 - CAIP-2 network identifiers (EIP-155)
 */
export const EVM_NETWORK_ID_SCHEMA = z.enum([
  // Mainnets
  'eip155:1',
  'eip155:8453',
  'eip155:137',
  'eip155:42161',
  // Testnets
  'eip155:11155111',
  'eip155:84532',
  'eip155:80002',
  'eip155:421614',
  // Local
  'eip155:31337',
]);

/**
 * Alias for backwards compatibility
 */
export const NETWORK_ID_SCHEMA = EVM_NETWORK_ID_SCHEMA;

/**
 * Schema for payment scheme
 */
export const PAYMENT_SCHEME_SCHEMA = z.literal('exact');

/**
 * Schema for EVM signature (compact 65-byte format)
 */
export const SIGNATURE_SCHEMA = z
  .string()
  .regex(signatureRegex, 'Invalid EVM signature format (expected 65 bytes)');

/**
 * Schema for EVM address
 */
export const ADDRESS_SCHEMA = z
  .string()
  .regex(evmAddressRegex, 'Invalid EVM address format');

/**
 * Schema for nullable EVM address (for native ETH)
 */
export const NULLABLE_ADDRESS_SCHEMA = z
  .string()
  .regex(evmAddressRegex, 'Invalid EVM address format')
  .nullable();

/**
 * Schema for payment authorization (EIP-712)
 */
export const PAYMENT_AUTHORIZATION_SCHEMA = z.object({
  from: ADDRESS_SCHEMA,
  to: ADDRESS_SCHEMA,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  token: NULLABLE_ADDRESS_SCHEMA,
  nonce: z.string().regex(/^\d+$/, 'Nonce must be a numeric string'),
  validUntil: z.string().regex(/^\d+$/, 'Valid until must be a numeric string'),
  chainId: z.number().int().positive('Chain ID must be a positive integer'),
});

/**
 * Schema for resource info
 * Spec compliance: x402 v2 - ResourceInfo Schema
 */
export const RESOURCE_INFO_SCHEMA = z.object({
  url: z.string().min(1, 'URL is required'),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});

/**
 * Schema for extension data
 * Spec compliance: x402 v2 - Extensions System
 */
export const EXTENSION_DATA_SCHEMA = z.object({
  info: z.unknown(),
  schema: z.object({}).optional(),
});

/**
 * Schema for payment requirements
 * Spec compliance: x402 v2 - PaymentRequirements Schema
 */
export const PAYMENT_REQUIREMENTS_SCHEMA = z.object({
  scheme: PAYMENT_SCHEME_SCHEMA,
  network: EVM_NETWORK_ID_SCHEMA,
  amount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  asset: NULLABLE_ADDRESS_SCHEMA,
  payTo: ADDRESS_SCHEMA,
  maxTimeoutSeconds: z
    .number()
    .int()
    .positive('maxTimeoutSeconds must be a positive integer'),
  extra: z
    .object({
      name: z.string().optional(),
      symbol: z.string().optional(),
      decimals: z.number().int().nonnegative().optional(),
      creContract: ADDRESS_SCHEMA.optional(),
    })
    .optional(),
});

/**
 * Alias for v2 schema naming consistency
 */
export const PAYMENT_REQUIREMENTS_V2_SCHEMA = PAYMENT_REQUIREMENTS_SCHEMA;

/**
 * Schema for exact EVM payload
 * Spec compliance: x402 v2 - scheme_exact_evm
 */
export const EXACT_EVM_PAYLOAD_SCHEMA = z.object({
  signature: SIGNATURE_SCHEMA,
  authorization: PAYMENT_AUTHORIZATION_SCHEMA,
});

/**
 * Schema for EIP-712 domain
 */
export const EIP712_DOMAIN_SCHEMA = z.object({
  name: z.string(),
  version: z.string(),
  chainId: z.number().int().positive(),
  verifyingContract: ADDRESS_SCHEMA,
});

/**
 * Schema for EIP-712 typed data
 */
export const EIP712_TYPED_DATA_SCHEMA = z.object({
  domain: EIP712_DOMAIN_SCHEMA,
  types: z.record(
    z.string(),
    z.array(z.object({ name: z.string(), type: z.string() }))
  ),
  primaryType: z.string(),
  message: z.record(z.string(), z.unknown()),
});

/**
 * Schema for payment payload
 * Spec compliance: x402 v2 - PaymentPayload Schema
 */
export const PAYMENT_PAYLOAD_SCHEMA = z
  .object({
    x402Version: z.literal(2),
    resource: RESOURCE_INFO_SCHEMA.optional(),
    accepted: PAYMENT_REQUIREMENTS_SCHEMA,
    payload: EXACT_EVM_PAYLOAD_SCHEMA,
    extensions: z.record(z.string(), z.unknown()).optional(),
    typedData: EIP712_TYPED_DATA_SCHEMA.optional(),
    creEndpoint: z.string().url('Invalid CRE endpoint URL').optional(),
  })
  .passthrough(); // Allow additional fields for forward compatibility

/**
 * Alias for v2 schema naming consistency
 */
export const PAYMENT_PAYLOAD_V2_SCHEMA = PAYMENT_PAYLOAD_SCHEMA;

/**
 * Schema for payment required response (402 response)
 * Spec compliance: x402 v2 - PaymentRequired Schema
 */
export const PAYMENT_REQUIRED_SCHEMA = z.object({
  x402Version: z.literal(2),
  error: z.string().optional(),
  resource: RESOURCE_INFO_SCHEMA,
  accepts: z.array(PAYMENT_REQUIREMENTS_SCHEMA).min(1),
  extensions: z.record(z.string(), EXTENSION_DATA_SCHEMA).optional(),
});

/**
 * Schema for invalid payment reason
 * Spec compliance: x402 v2 - Error Codes
 */
export const INVALID_PAYMENT_REASON_SCHEMA = z.enum([
  // Generic error codes
  'invalid_signature',
  'insufficient_funds',
  'invalid_network',
  'invalid_amount',
  'invalid_payload',
  'invalid_payment_requirements',
  'invalid_scheme',
  'unsupported_scheme',
  'invalid_x402_version',
  'invalid_transaction_state',
  'unexpected_verify_error',
  'unexpected_settle_error',
  // EVM-specific error codes
  'invalid_exact_evm_payload_authorization_valid_until',
  'invalid_exact_evm_payload_authorization_value',
  'invalid_exact_evm_payload_signature',
  'invalid_exact_evm_payload_recipient_mismatch',
  'invalid_exact_evm_payload_token_mismatch',
  'invalid_exact_evm_payload_nonce_used',
  'invalid_exact_evm_payload_chain_id_mismatch',
  'insufficient_allowance',
  'cre_workflow_failed',
]);

/**
 * Schema for transaction status
 */
export const TRANSACTION_STATUS_SCHEMA = z.enum([
  'pending',
  'confirmed',
  'failed',
  'reverted',
]);

/**
 * Schema for verify response
 * Spec compliance: x402 v2 - VerifyResponse Schema
 */
export const VERIFY_RESPONSE_SCHEMA = z.object({
  isValid: z.boolean(),
  invalidReason: INVALID_PAYMENT_REASON_SCHEMA.optional(),
  payer: ADDRESS_SCHEMA.optional(),
  details: z
    .object({
      balance: z.string().optional(),
      allowance: z.string().optional(),
      nonceUsed: z.boolean().optional(),
      timestamp: z.number().int().optional(),
      error: z.string().optional(),
      validUntil: z.string().optional(),
      currentTimestamp: z.string().optional(),
    })
    .optional(),
});

/**
 * Alias for v2 schema naming consistency
 */
export const VERIFY_RESPONSE_V2_SCHEMA = VERIFY_RESPONSE_SCHEMA;

/**
 * Schema for settle response
 * Spec compliance: x402 v2 - SettlementResponse Schema
 */
export const SETTLE_RESPONSE_SCHEMA = z.object({
  success: z.boolean(),
  errorReason: z.string().optional(),
  payer: ADDRESS_SCHEMA.optional(),
  transaction: z.union([
    z.string().regex(bytes32Regex, 'Invalid transaction hash format'),
    z.literal(''),
  ]),
  network: EVM_NETWORK_ID_SCHEMA,
  status: TRANSACTION_STATUS_SCHEMA.optional(),
  blockNumber: z.number().int().nonnegative().optional(),
  blockHash: z
    .string()
    .regex(bytes32Regex, 'Invalid block hash format')
    .optional(),
  workflowId: z.string().optional(),
});

/**
 * Alias for v2 schema naming consistency
 */
export const SETTLE_RESPONSE_V2_SCHEMA = SETTLE_RESPONSE_SCHEMA;

/**
 * Schema for supported kind
 * Spec compliance: x402 v2 - GET /supported
 */
export const SUPPORTED_KIND_SCHEMA = z.object({
  x402Version: z.literal(2),
  scheme: PAYMENT_SCHEME_SCHEMA,
  network: EVM_NETWORK_ID_SCHEMA,
  extra: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for supported response
 * Spec compliance: x402 v2 - GET /supported Response
 */
export const SUPPORTED_RESPONSE_SCHEMA = z.object({
  kinds: z.array(SUPPORTED_KIND_SCHEMA),
  extensions: z.array(z.string()),
  signers: z.record(z.string(), z.array(z.string())),
});

/**
 * Schema for native currency
 */
export const NATIVE_CURRENCY_SCHEMA = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().nonnegative(),
});

/**
 * Schema for network config
 */
export const NETWORK_CONFIG_SCHEMA = z.object({
  network: EVM_NETWORK_ID_SCHEMA,
  chainId: z.number().int().positive('Chain ID must be a positive integer'),
  rpcUrl: z.string().url('RPC URL must be a valid URL'),
  explorerUrl: z.string().url('Explorer URL must be a valid URL').nullable(),
  name: z.string().min(1, 'Network name cannot be empty'),
  type: z.enum(['mainnet', 'testnet', 'local']),
  nativeCurrency: NATIVE_CURRENCY_SCHEMA,
});

/**
 * Schema for account config
 */
export const ACCOUNT_CONFIG_SCHEMA = z.object({
  address: ADDRESS_SCHEMA,
  privateKey: z
    .string()
    .regex(bytes32Regex, 'Invalid private key format')
    .optional(),
  network: EVM_NETWORK_ID_SCHEMA,
});

/**
 * Schema for provider options
 */
export const PROVIDER_OPTIONS_SCHEMA = z.object({
  network: EVM_NETWORK_ID_SCHEMA,
  rpcUrl: z.string().url('RPC URL must be a valid URL').optional(),
  timeout: z.number().int().positive().optional(),
  retries: z.number().int().nonnegative().optional(),
});

/**
 * Schema for resource type
 * Spec compliance: x402 v2 - Section 8
 */
export const RESOURCE_TYPE_SCHEMA = z.enum(['http', 'mcp', 'a2a']);

/**
 * Schema for resource metadata
 */
export const RESOURCE_METADATA_SCHEMA = z
  .object({
    category: z.string().optional(),
    provider: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })
  .catchall(z.unknown());

/**
 * Schema for discovered resource
 * Spec compliance: x402 v2 - Section 8.2
 */
export const DISCOVERED_RESOURCE_SCHEMA = z.object({
  resource: z.string().min(1, 'Resource URL is required'),
  type: RESOURCE_TYPE_SCHEMA,
  x402Version: z.number().int().positive(),
  accepts: z.array(PAYMENT_REQUIREMENTS_SCHEMA).min(1),
  lastUpdated: z.number().int().nonnegative(),
  metadata: RESOURCE_METADATA_SCHEMA.optional(),
});

/**
 * Schema for discovery pagination
 */
export const DISCOVERY_PAGINATION_SCHEMA = z.object({
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/**
 * Schema for discovery response
 * Spec compliance: x402 v2 - Section 8.1
 */
export const DISCOVERY_RESPONSE_SCHEMA = z.object({
  x402Version: z.literal(2),
  items: z.array(DISCOVERED_RESOURCE_SCHEMA),
  pagination: DISCOVERY_PAGINATION_SCHEMA,
});

/**
 * Schema for discovery parameters
 */
export const DISCOVERY_PARAMS_SCHEMA = z.object({
  type: RESOURCE_TYPE_SCHEMA.optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  network: z.string().optional(),
  category: z.string().optional(),
  provider: z.string().optional(),
  query: z.string().optional(),
});

/**
 * Schema for resource registration request
 */
export const REGISTER_RESOURCE_REQUEST_SCHEMA = z.object({
  resource: z.string().min(1, 'Resource URL is required'),
  type: RESOURCE_TYPE_SCHEMA,
  accepts: z.array(PAYMENT_REQUIREMENTS_SCHEMA).min(1),
  metadata: RESOURCE_METADATA_SCHEMA.optional(),
});

/**
 * Schema for resource registration response
 */
export const REGISTER_RESOURCE_RESPONSE_SCHEMA = z.object({
  success: z.boolean(),
  resourceId: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Schema for CRE workflow result
 */
export const CRE_WORKFLOW_RESULT_SCHEMA = z.object({
  success: z.boolean(),
  transactionHash: z
    .string()
    .regex(bytes32Regex, 'Invalid transaction hash')
    .optional(),
  error: z.string().optional(),
  executionId: z.string(),
  consensusReached: z.boolean(),
});
