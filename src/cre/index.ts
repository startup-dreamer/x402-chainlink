/**
 * Chainlink Runtime Environment (CRE) module
 *
 * This module provides the client and workflow implementations
 * for x402 payment verification and settlement using Chainlink CRE.
 *
 * @module cre
 */

export {
  CREClient,
  createCREClient,
  createCREClientForNetwork,
  createSimulationClient,
  getEndpointConfig,
} from './client.js';
export type { SimulationClientOptions } from './client.js';
export {
  executeCREWorkflow,
  isCRECLIAvailable,
  getCRECLIVersion,
} from './cli-executor.js';
export type { CRECLIConfig } from './cli-executor.js';
export {
  CREWorkflowHandler,
  createWorkflowHandler,
  executeWorkflow,
} from './workflow.js';
export type {
  CREClientConfig,
  CRETriggerType,
  CREExecutionMode,
  CREWorkflowAction,
  CREPaymentAuthorization,
  CREPermitData,
  CREWorkflowRequest,
  CREWorkflowRequestWithRequirements,
  CREVerificationResult,
  CRESettlementResult,
  CREConsensusInfo,
  CREWorkflowResponse,
  CREWorkflowResponseExtended,
  CRESupportedCapabilities,
  CREEndpointConfig,
  VerificationReason,
} from './types.js';
export {
  DEFAULT_CRE_ENDPOINTS,
  FORWARDER_ADDRESSES,
  getForwarderAddress,
} from './types.js';
