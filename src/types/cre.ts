/**
 * Chainlink CRE (Chainlink Runtime Environment) types
 * For workflow orchestration and execution
 */

import type { EVMNetworkId } from './network.js';

/**
 * CRE Workflow configuration
 */
export interface CREConfig {
  /** CRE workflow endpoint URL */
  endpoint: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Target network for settlement */
  network: EVMNetworkId;
  /** Whether to use simulation mode */
  simulation?: boolean;
}

/**
 * CRE execution mode
 */
export type CREExecutionMode = 'simulation' | 'production';

/**
 * CRE workflow trigger types
 */
export type CRETriggerType = 'http' | 'cron' | 'evm_log';

/**
 * CRE workflow request
 */
export interface CREWorkflowRequest {
  /** Workflow action */
  action: 'verify' | 'settle' | 'verify_and_settle';
  /** Payment payload from client */
  paymentPayload: {
    signature: `0x${string}`;
    authorization: {
      from: `0x${string}`;
      to: `0x${string}`;
      amount: string;
      token: `0x${string}`;
      nonce: string;
      validUntil: string;
      chainId: number;
    };
  };
  /** Payment requirements from server */
  paymentRequirements: {
    network: EVMNetworkId;
    amount: string;
    asset: `0x${string}` | null;
    payTo: `0x${string}`;
  };
  /** EIP-712 typed data for signature verification */
  typedData?: {
    domain: {
      name: string;
      version: string;
      chainId: number;
      verifyingContract: `0x${string}`;
    };
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  };
}

/**
 * CRE workflow response
 */
export interface CREWorkflowResponse {
  /** Whether the workflow executed successfully */
  success: boolean;
  /** Workflow execution ID */
  executionId: string;
  /** Result data */
  result?: {
    /** Verification result (if verify action) */
    verification?: {
      isValid: boolean;
      invalidReason?: string;
      payer?: `0x${string}`;
    };
    /** Settlement result (if settle action) */
    settlement?: {
      transactionHash: `0x${string}`;
      blockNumber?: number;
      gasUsed?: string;
    };
  };
  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  /** Consensus information */
  consensus: {
    /** Number of nodes that participated */
    nodeCount: number;
    /** Whether consensus was reached */
    reached: boolean;
    /** Consensus threshold */
    threshold: number;
  };
}

/**
 * CRE EVM read request
 */
export interface CREEvmReadRequest {
  /** Target chain ID */
  chainId: number;
  /** Contract address */
  contractAddress: `0x${string}`;
  /** Function to call */
  functionName: string;
  /** Function arguments */
  args: unknown[];
  /** ABI for the function */
  abi: readonly unknown[];
}

/**
 * CRE EVM write request
 */
export interface CREEvmWriteRequest {
  /** Target chain ID */
  chainId: number;
  /** Contract address */
  contractAddress: `0x${string}`;
  /** Function to call */
  functionName: string;
  /** Function arguments */
  args: unknown[];
  /** ABI for the function */
  abi: readonly unknown[];
  /** Value to send (for payable functions) */
  value?: bigint;
}

/**
 * CRE HTTP request
 */
export interface CREHttpRequest {
  /** Request URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Response timeout in ms */
  timeout?: number;
}

/**
 * CRE capability types
 */
export type CRECapability =
  | 'http'
  | 'confidential_http'
  | 'evm_read'
  | 'evm_write'
  | 'secrets';

/**
 * CRE workflow metadata
 */
export interface CREWorkflowMetadata {
  /** Workflow ID */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow version */
  version: string;
  /** Supported capabilities */
  capabilities: CRECapability[];
  /** Supported trigger types */
  triggers: CRETriggerType[];
  /** Supported networks */
  networks: EVMNetworkId[];
}

/**
 * CRE simulation result
 */
export interface CRESimulationResult {
  /** Whether simulation succeeded */
  success: boolean;
  /** Simulated transaction result */
  result?: {
    /** Would the transaction succeed */
    wouldSucceed: boolean;
    /** Estimated gas */
    gasEstimate: string;
    /** Return value (if applicable) */
    returnValue?: unknown;
  };
  /** Simulation error */
  error?: string;
  /** Execution trace (for debugging) */
  trace?: Array<{
    step: number;
    action: string;
    result: unknown;
  }>;
}
