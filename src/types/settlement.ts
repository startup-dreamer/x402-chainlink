/**
 * Settlement and verification type definitions for EVM x402
 * Spec compliance: x402 v2
 */

import type { EVMNetworkId } from './network.js';

/**
 * Reason for invalid payment
 * Spec compliance: x402 v2 - Error Codes
 */
export type InvalidPaymentReason =
  // Generic error codes
  | 'invalid_signature'
  | 'insufficient_funds'
  | 'invalid_network'
  | 'invalid_amount'
  | 'invalid_payload'
  | 'invalid_payment_requirements'
  | 'invalid_scheme'
  | 'unsupported_scheme'
  | 'invalid_x402_version'
  | 'invalid_transaction_state'
  | 'unexpected_verify_error'
  | 'unexpected_settle_error'
  // EVM-specific error codes (following v2 scheme naming pattern)
  | 'invalid_exact_evm_payload_authorization_valid_until'
  | 'invalid_exact_evm_payload_authorization_value'
  | 'invalid_exact_evm_payload_signature'
  | 'invalid_exact_evm_payload_recipient_mismatch'
  | 'invalid_exact_evm_payload_token_mismatch'
  | 'invalid_exact_evm_payload_nonce_used'
  | 'invalid_exact_evm_payload_chain_id_mismatch'
  | 'insufficient_allowance'
  | 'cre_workflow_failed';

/**
 * Verification response from facilitator
 * Spec compliance: x402 v2 - VerifyResponse Schema
 */
export interface VerifyResponse {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Reason for invalidity if isValid is false */
  invalidReason?: InvalidPaymentReason | undefined;
  /** Payer address (optional per v2 spec) */
  payer?: `0x${string}` | undefined;
  /** Additional verification details (internal use) */
  details?:
    | {
        /** Current token balance of payer */
        balance?: string | undefined;
        /** Token allowance for CRE contract */
        allowance?: string | undefined;
        /** Whether nonce has been used */
        nonceUsed?: boolean | undefined;
        /** Current timestamp */
        timestamp?: number | undefined;
        /** Error message for debugging */
        error?: string | undefined;
        /** Valid until timestamp */
        validUntil?: string | undefined;
        /** Current timestamp at verification */
        currentTimestamp?: string | undefined;
      }
    | undefined;
}

/**
 * Transaction status for EVM
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'reverted';

/**
 * Settlement response from facilitator
 * Spec compliance: x402 v2 - SettlementResponse Schema
 */
export interface SettleResponse {
  /** Whether settlement was successful */
  success: boolean;
  /** Reason for failure if success is false */
  errorReason?: string | undefined;
  /** Payer address (optional per v2 spec) */
  payer?: `0x${string}` | undefined;
  /** Transaction hash (empty string if failed) */
  transaction: `0x${string}` | '';
  /** Network the transaction was submitted to (CAIP-2 format) */
  network: EVMNetworkId;
  /** Transaction status */
  status?: TransactionStatus | undefined;
  /** Block number (if confirmed) */
  blockNumber?: number | undefined;
  /** Block hash (if confirmed) */
  blockHash?: `0x${string}` | undefined;
  /** CRE workflow execution ID (if applicable) */
  workflowId?: string | undefined;
}

/**
 * Settlement request to facilitator
 * Spec compliance: x402 v2 - Facilitator API
 */
export interface SettleRequest {
  /** Payment payload from client */
  paymentPayload: unknown;
  /** Payment requirements from server */
  paymentRequirements: unknown;
}

/**
 * Verification request to facilitator
 * Spec compliance: x402 v2 - Facilitator API
 */
export interface VerifyRequest {
  /** Payment payload from client */
  paymentPayload: unknown;
  /** Payment requirements from server */
  paymentRequirements: unknown;
}

/**
 * Supported payment kind
 * Spec compliance: x402 v2 - GET /supported
 */
export interface SupportedKind {
  /** x402 protocol version */
  x402Version: 2;
  /** Payment scheme */
  scheme: 'exact';
  /** Network identifier (CAIP-2 format) */
  network: EVMNetworkId;
  /** Additional scheme-specific data */
  extra?: Record<string, unknown>;
}

/**
 * Supported payment kinds response
 * Spec compliance: x402 v2 - GET /supported Response
 */
export interface SupportedResponse {
  /** Array of supported payment kinds */
  kinds: Array<SupportedKind>;
  /** Supported protocol extensions */
  extensions: Array<string>;
  /** Signer standards by network type */
  signers: Record<string, Array<string>>;
}

/**
 * CRE Workflow result
 */
export interface CREWorkflowResult {
  /** Whether the workflow executed successfully */
  success: boolean;
  /** Transaction hash if settlement was executed */
  transactionHash?: `0x${string}`;
  /** Error message if failed */
  error?: string;
  /** Workflow execution ID */
  executionId: string;
  /** Consensus reached by DON */
  consensusReached: boolean;
}
