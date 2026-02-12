/**
 * Type definitions for EVM x402 with Chainlink CRE
 * Spec compliance: x402 v2
 * @module types
 */

// Network types
export type {
  EVMNetworkId,
  NetworkType,
  NativeCurrency,
  NetworkConfig,
  AccountConfig,
  ProviderOptions,
} from './network.js';

// Network utilities
export {
  isCAIP2Network,
  toCAIP2Network,
  normalizeNetwork,
  networksEqual,
  getChainId,
  fromChainId,
} from './network.js';

// Payment types
export type {
  PaymentScheme,
  Signature,
  CompactSignature,
  PaymentAuthorization,
  ResourceInfo,
  ExtensionData,
  PaymentRequirements,
  PaymentRequired,
  ExactEVMPayload,
  PaymentPayload,
  PaymentRequirementsSelector,
  EIP712TypedData,
  // EIP-2612 Permit types
  PermitData,
  EIP2612PermitMessage,
  PermitDomain,
  CreatePaymentWithPermitOptions,
} from './payment.js';

// Payment constants
export {
  X402_EIP712_DOMAIN,
  X402_EIP712_TYPES,
  PERMIT_EIP712_TYPES,
} from './payment.js';

// Settlement types
export type {
  InvalidPaymentReason,
  TransactionStatus,
  VerifyResponse,
  SettleResponse,
  SettleRequest,
  VerifyRequest,
  SupportedKind,
  SupportedResponse,
  CREWorkflowResult,
} from './settlement.js';

// Discovery types
export type {
  ResourceType,
  ResourceMetadata,
  DiscoveredResource,
  DiscoveryPagination,
  DiscoveryResponse,
  DiscoveryParams,
  RegisterResourceRequest,
  RegisterResourceResponse,
} from './discovery.js';

// Zod schemas
export {
  // Network schemas
  EVM_NETWORK_ID_SCHEMA,
  NETWORK_ID_SCHEMA,
  // Address schemas
  ADDRESS_SCHEMA,
  NULLABLE_ADDRESS_SCHEMA,
  // Common schemas
  PAYMENT_SCHEME_SCHEMA,
  SIGNATURE_SCHEMA,
  PAYMENT_AUTHORIZATION_SCHEMA,
  // Payment schemas
  RESOURCE_INFO_SCHEMA,
  EXTENSION_DATA_SCHEMA,
  PAYMENT_REQUIREMENTS_SCHEMA,
  PAYMENT_REQUIREMENTS_V2_SCHEMA,
  EXACT_EVM_PAYLOAD_SCHEMA,
  EIP712_DOMAIN_SCHEMA,
  EIP712_TYPED_DATA_SCHEMA,
  PAYMENT_PAYLOAD_SCHEMA,
  PAYMENT_PAYLOAD_V2_SCHEMA,
  PAYMENT_REQUIRED_SCHEMA,
  // Settlement schemas
  INVALID_PAYMENT_REASON_SCHEMA,
  TRANSACTION_STATUS_SCHEMA,
  VERIFY_RESPONSE_SCHEMA,
  VERIFY_RESPONSE_V2_SCHEMA,
  SETTLE_RESPONSE_SCHEMA,
  SETTLE_RESPONSE_V2_SCHEMA,
  SUPPORTED_KIND_SCHEMA,
  SUPPORTED_RESPONSE_SCHEMA,
  // Config schemas
  NATIVE_CURRENCY_SCHEMA,
  NETWORK_CONFIG_SCHEMA,
  ACCOUNT_CONFIG_SCHEMA,
  PROVIDER_OPTIONS_SCHEMA,
  // Discovery schemas
  RESOURCE_TYPE_SCHEMA,
  RESOURCE_METADATA_SCHEMA,
  DISCOVERED_RESOURCE_SCHEMA,
  DISCOVERY_PAGINATION_SCHEMA,
  DISCOVERY_RESPONSE_SCHEMA,
  DISCOVERY_PARAMS_SCHEMA,
  REGISTER_RESOURCE_REQUEST_SCHEMA,
  REGISTER_RESOURCE_RESPONSE_SCHEMA,
  // CRE schemas
  CRE_WORKFLOW_RESULT_SCHEMA,
} from './schemas.js';

// CRE types
export type {
  CREConfig,
  CREExecutionMode,
  CRETriggerType,
  CREWorkflowRequest,
  CREWorkflowResponse,
  CREEvmReadRequest,
  CREEvmWriteRequest,
  CREHttpRequest,
  CRECapability,
  CREWorkflowMetadata,
  CRESimulationResult,
} from './cre.js';
