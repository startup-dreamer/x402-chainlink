import type { EVMNetworkId, EIP712TypedData } from '../types/index.js';

/**
 * CRE client configuration
 */
export interface CREClientConfig {
  /** CRE workflow endpoint URL (from deployed workflow) */
  endpoint: string;

  /** API key for authentication (optional, may be required in production) */
  apiKey?: string | undefined;

  /** Target network for settlement */
  network: EVMNetworkId;

  /** Deployed workflow ID (from cre workflow deploy output) */
  workflowId?: string | undefined;

  /** X402Facilitator contract address on target network */
  facilitatorAddress: `0x${string}`;

  /** Request timeout in milliseconds */
  timeout?: number | undefined;

  /**
   * Use simulation mode
   */
  simulation?: boolean | undefined;

  /** Environment: staging (testnets) or production (mainnets) */
  environment?: 'staging' | 'production' | undefined;

  /**
   * Path to the x402-workflow folder (for simulation mode)
   * Relative to the current working directory or absolute path
   * @default "./x402-workflow"
   */
  workflowPath?: string | undefined;

  /**
   * CRE target settings name from workflow.yaml (for simulation mode)
   * @default "staging-settings"
   */
  targetSettings?: string | undefined;

  /**
   * Enable --broadcast flag for real transactions in simulation
   * When true, settlement transactions are actually submitted to the blockchain
   * @default false
   */
  broadcastInSimulation?: boolean | undefined;

  /**
   * Enable CRE engine logs for debugging simulation
   * @default false
   */
  engineLogs?: boolean | undefined;
}

/**
 * CRE workflow trigger types
 */
export type CRETriggerType = 'http' | 'cron' | 'evm_log';

/**
 * CRE execution mode
 */
export type CREExecutionMode = 'simulation' | 'production';

/**
 * CRE workflow actions
 */
export type CREWorkflowAction = 'verify' | 'settle' | 'verify_and_settle';

/**
 * Payment authorization for CRE workflow
 */
export interface CREPaymentAuthorization {
  /** Payer address */
  from: `0x${string}`;
  /** Recipient address */
  to: `0x${string}`;
  /** Amount in token's smallest unit (string for bigint compatibility) */
  amount: string;
  /** Token address */
  token: `0x${string}`;
  /** Unique nonce for replay protection */
  nonce: string;
  /** Unix timestamp when payment expires (0 for no expiry) */
  validUntil: string;
  /** Chain ID for cross-chain protection */
  chainId: number;
}

/**
 * EIP-2612 Permit data for gasless approvals
 */
export interface CREPermitData {
  /** Permit deadline (Unix timestamp in seconds) */
  deadline: string;
  /** v component of permit signature */
  v: number;
  /** r component of permit signature */
  r: `0x${string}`;
  /** s component of permit signature */
  s: `0x${string}`;
}

/**
 * CRE workflow request payload
 */
export interface CREWorkflowRequest {
  /** Workflow action to execute */
  action: CREWorkflowAction;
  /** EIP-712 signature from the payer */
  signature: `0x${string}`;
  /** Payment authorization details */
  authorization: CREPaymentAuthorization;
  /** Payment requirements (for validation, optional) */
  requirements?:
    | {
        network: EVMNetworkId;
        amount: string;
        asset: `0x${string}` | null;
        payTo: `0x${string}`;
      }
    | undefined;
  /** EIP-712 typed data (optional, for additional verification) */
  typedData?: EIP712TypedData | undefined;
  /** Optional EIP-2612 permit data for gasless approvals */
  permit?: CREPermitData | undefined;
}

/**
 * Extended CRE workflow request with requirements
 */
export interface CREWorkflowRequestWithRequirements extends CREWorkflowRequest {
  /** Payment requirements for validation */
  requirements: {
    network: EVMNetworkId;
    amount: string;
    asset: `0x${string}` | null;
    payTo: `0x${string}`;
  };
  /** EIP-712 typed data (optional, for additional verification) */
  typedData?: EIP712TypedData | undefined;
}

/**
 * CRE verification result
 */
export interface CREVerificationResult {
  /** Whether the payment is valid */
  isValid: boolean;
  /** Reason for invalidity (if not valid) */
  reason?: string | undefined;
  /** Reason for invalidity (legacy alias) */
  invalidReason?: string | undefined;
  /** Payer address (recovered from signature) */
  payer?: `0x${string}` | undefined;
  /** Token balance of payer */
  balance?: string | undefined;
  /** Token allowance for facilitator */
  allowance?: string | undefined;
}

/**
 * CRE settlement result
 */
export interface CRESettlementResult {
  /** Whether the settlement report was submitted */
  reportSubmitted: boolean;
  /** Transaction hash (from KeystoneForwarder) */
  txHash?: string | undefined;
  /** Transaction hash (legacy alias) */
  transactionHash?: `0x${string}` | undefined;
  /** Block number of settlement (optional) */
  blockNumber?: number | undefined;
  /** Gas used (optional) */
  gasUsed?: string | undefined;
  /** Status of settlement */
  status?: 'confirmed' | 'pending' | 'failed' | undefined;
  /** Error message if settlement failed */
  error?: string | undefined;
}

/**
 * CRE consensus information
 */
export interface CREConsensusInfo {
  /** Number of nodes that participated */
  nodeCount: number;
  /** Whether consensus was reached */
  reached: boolean;
  /** Required threshold for consensus */
  threshold: number;
  /** Timestamp of consensus */
  timestamp?: number | undefined;
}

/**
 * CRE workflow response
 * This is the response from the CRE workflow HTTP trigger
 */
export interface CREWorkflowResponse {
  /** Whether the workflow executed successfully */
  success: boolean;
  /** Unique execution ID */
  executionId?: string | undefined;
  /** Action that was executed */
  action: string;
  /** Verification result (if verify or verify_and_settle) */
  verification?: CREVerificationResult | undefined;
  /** Settlement result (if settle or verify_and_settle) */
  settlement?: CRESettlementResult | undefined;
  /** Error information */
  error?: { code: string; message: string; details?: unknown } | undefined;
  /** Consensus information */
  consensus?: CREConsensusInfo | undefined;
  /** Execution mode used */
  mode?: CREExecutionMode | undefined;
  /** Execution duration in milliseconds */
  durationMs?: number | undefined;
  /** Timestamp of response */
  timestamp?: number | undefined;
}

/**
 * Extended workflow response with execution details
 */
export interface CREWorkflowResponseExtended extends CREWorkflowResponse {
  /** Unique execution ID */
  executionId?: string | undefined;
  /** Consensus information */
  consensus?: CREConsensusInfo | undefined;
  /** Execution mode used */
  mode?: CREExecutionMode | undefined;
  /** Execution duration in milliseconds */
  durationMs?: number | undefined;
}

/**
 * CRE supported capabilities response
 */
export interface CRESupportedCapabilities {
  /** Available trigger types */
  triggers: CRETriggerType[];
  /** Supported networks */
  networks: EVMNetworkId[];
  /** Supported actions */
  actions: CREWorkflowAction[];
  /** Is simulation mode available */
  simulationAvailable: boolean;
  /** Version of the CRE workflow */
  version: string;
  /** Facilitator contract address */
  facilitatorAddress?: `0x${string}` | undefined;
}

/**
 * CRE endpoint configuration per network
 */
export interface CREEndpointConfig {
  /** Workflow endpoint URL */
  endpoint: string;
  /** X402Facilitator contract address */
  facilitatorAddress: `0x${string}`;
  /** Forwarder type (mock for simulation, keystone for production) */
  forwarderType: 'mock' | 'keystone';
}

/**
 * Default CRE endpoints for x402
 *
 * The endpoint URL format is:
 * https://cre.chain.link/v1/workflows/{workflow-id}/trigger
 */
export const DEFAULT_CRE_ENDPOINTS: Partial<
  Record<EVMNetworkId, CREEndpointConfig>
> = {
  'eip155:84532': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-staging/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'mock',
  },

  'eip155:11155111': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-staging/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'mock',
  },

  'eip155:421614': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-staging/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'mock',
  },

  'eip155:8453': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-production/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'keystone',
  },

  'eip155:1': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-production/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'keystone',
  },

  'eip155:137': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-production/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'keystone',
  },

  'eip155:42161': {
    endpoint:
      'https://cre.chain.link/v1/workflows/x402-payment-workflow-production/trigger',
    facilitatorAddress: '0x0000000000000000000000000000000000000000', // Deploy and update
    forwarderType: 'keystone',
  },

  'eip155:31337': {
    endpoint: 'http://localhost:8787/x402',
    facilitatorAddress: '0x0000000000000000000000000000000000000000',
    forwarderType: 'mock',
  },
};

/**
 * Known forwarder addresses per network
 */
export const FORWARDER_ADDRESSES: Record<
  string,
  {
    mock: `0x${string}`;
    keystone: `0x${string}`;
  }
> = {
  'eip155:84532': {
    mock: '0x15fC6ae953E024d975e77382eEeC56A9101f9F88',
    keystone: '0x1a1c2103A4BCb04F548e9525D4cc33Ac47f1Ec44',
  },
  'eip155:11155111': {
    mock: '0x15fC6ae953E024d975e77382eEeC56A9101f9F88',
    keystone: '0xF8344CFd5c43616a4366C34E3EEE75af79a74482',
  },
};

/**
 * Get forwarder address for a network and type
 */
export function getForwarderAddress(
  network: EVMNetworkId,
  type: 'mock' | 'keystone'
): `0x${string}` | undefined {
  return FORWARDER_ADDRESSES[network]?.[type];
}

/**
 * Verification status reasons
 */
export type VerificationReason =
  | 'valid'
  | 'payment_expired'
  | 'invalid_signature'
  | 'insufficient_balance'
  | 'insufficient_allowance'
  | 'invalid_from_address'
  | 'invalid_to_address'
  | 'invalid_amount'
  | 'invalid_chain_id'
  | 'nonce_already_used'
  | 'cre_workflow_failed'
  | 'network_error';
