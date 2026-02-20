/**
 * CRE (Chainlink Runtime Environment) Client
 * HTTP client for triggering and managing x402 payment workflows
 *
 * This client provides a TypeScript interface for:
 * - Triggering deployed CRE workflows via HTTP
 * - Verifying payments (balance + allowance checks)
 * - Settling payments (submitting reports to X402Facilitator)
 * - Local simulation for development/testing
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { PublicClient, Chain, HttpTransport } from 'viem';
import type {
  CREClientConfig,
  CREWorkflowRequest,
  CREWorkflowResponse,
  CREWorkflowResponseExtended,
  CRESupportedCapabilities,
  CREWorkflowAction,
  CREPaymentAuthorization,
  CREEndpointConfig,
} from './types.js';
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  EVMNetworkId,
} from '../types/index.js';
import { err, wrapUnknown, isX402Error } from '../errors.js';
import { DEFAULT_CRE_ENDPOINTS } from './types.js';
import { executeCREWorkflow } from './cli-executor.js';

/**
 * CRE Client for x402 payment workflows
 *
 * This client communicates with the Chainlink Runtime Environment
 * to verify and settle payments using decentralized consensus.
 *
 * Usage:
 * ```typescript
 * const client = new CREClient({
 *   endpoint: 'https://cre.chain.link/v1/workflows/my-workflow/trigger',
 *   network: 'eip155:84532',
 *   facilitatorAddress: '0x...',
 *   simulation: false, // Use real CRE workflow
 * });
 *
 * const result = await client.verifyAndSettle(payload, requirements);
 * ```
 */
export class CREClient {
  private config: Required<
    Pick<CREClientConfig, 'endpoint' | 'network' | 'facilitatorAddress'>
  > &
    CREClientConfig;
  private requestId = 0;

  constructor(config: CREClientConfig) {
    // Validate endpoint for production mode
    if (!config.simulation) {
      this.validateProductionEndpoint(config.endpoint);
    }

    this.config = {
      timeout: 30000,
      simulation: false,
      environment: 'staging',
      workflowPath: resolveDefaultWorkflowPath(),
      targetSettings: 'staging-settings',
      broadcastInSimulation: false,
      engineLogs: false,
      ...config,
    };
  }

  /**
   * Validate that the endpoint is a valid production CRE workflow URL
   */
  private validateProductionEndpoint(endpoint: string): void {
    if (!endpoint || endpoint === '') {
      throw err.invalid(
        'Production mode requires a deployed workflow endpoint URL. ' +
          'Deploy with: cre workflow deploy x402-workflow --target <settings>'
      );
    }

    if (endpoint.startsWith('cli://') || endpoint.includes('localhost')) {
      throw err.invalid(
        'Production mode requires a deployed CRE workflow URL, not a local endpoint. ' +
          'Deploy with: cre workflow deploy x402-workflow --target <settings>'
      );
    }

    // Validate URL format
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:') {
        throw err.invalid(
          'Production endpoint must use HTTPS. ' +
            'Expected format: https://cre.chain.link/v1/workflows/{workflow-id}/trigger'
        );
      }
    } catch (e) {
      if (isX402Error(e)) {
        throw e;
      }
      throw err.invalid(
        `Invalid endpoint URL: ${endpoint}. ` +
          'Expected format: https://cre.chain.link/v1/workflows/{workflow-id}/trigger'
      );
    }
  }

  /**
   * Verify a payment using CRE workflow
   *
   * In production mode, this triggers the CRE workflow on the DON.
   *
   * @param payload - Payment payload with signature and authorization
   * @param requirements - Payment requirements (amount, recipient, etc.)
   * @param client - Viem PublicClient (optional, kept for backward compatibility)
   * @returns Verification result
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    client?: PublicClient<HttpTransport, Chain>
  ): Promise<VerifyResponse> {
    if (this.config.simulation) {
      const dummyClient = client ?? ({} as PublicClient<HttpTransport, Chain>);
      return this.simulateVerify(payload, requirements, dummyClient);
    }

    const request = this.buildWorkflowRequest('verify', payload);
    const response = await this.executeWorkflow(request);

    return this.mapVerificationResponse(response);
  }

  /**
   * Settle a payment using CRE workflow
   *
   * In production mode, this triggers the CRE workflow on the DON
   * which submits a signed report to the X402Facilitator contract
   * via KeystoneForwarder.
   *
   * @param payload - Payment payload with signature and authorization
   * @param requirements - Payment requirements
   * @param client - Viem PublicClient (optional, kept for backward compatibility)
   * @returns Settlement result
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    client?: PublicClient<HttpTransport, Chain>
  ): Promise<SettleResponse> {
    if (this.config.simulation) {
      const dummyClient = client ?? ({} as PublicClient<HttpTransport, Chain>);
      return this.simulateSettle(payload, requirements, dummyClient);
    }

    const request = this.buildWorkflowRequest('settle', payload);
    const response = await this.executeWorkflow(request);

    return this.mapSettlementResponse(response, requirements);
  }

  /**
   * Verify and settle a payment in one workflow execution
   * Recommended for production.
   * 
   * @param payload - Payment payload with signature and authorization
   * @param requirements - Payment requirements
   * @param client - Viem PublicClient (unused in simulation mode)
   * @returns Combined verification and settlement result
   */
  async verifyAndSettle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _client?: PublicClient<HttpTransport, Chain>
  ): Promise<{
    verifyResponse: VerifyResponse;
    settleResponse?: SettleResponse;
  }> {
    if (this.config.simulation) {
      const response = await this.simulateVerifyAndSettle(
        payload,
        requirements
      );

      const verifyResponse = this.mapVerificationResponse(response);

      if (!verifyResponse.isValid || !response.settlement) {
        return { verifyResponse };
      }

      const settleResponse = this.mapSettlementResponse(response, requirements);
      return { verifyResponse, settleResponse };
    }

    const request = this.buildWorkflowRequest('verify_and_settle', payload);
    const response = await this.executeWorkflow(request);

    const verifyResponse = this.mapVerificationResponse(response);

    if (!verifyResponse.isValid || !response.settlement) {
      return { verifyResponse };
    }

    const settleResponse = this.mapSettlementResponse(response, requirements);
    return { verifyResponse, settleResponse };
  }

  /**
   * Get supported capabilities from CRE workflow
   */
  async getSupportedCapabilities(): Promise<CRESupportedCapabilities> {
    const response = await this.request<CRESupportedCapabilities>(
      '/capabilities',
      { method: 'GET' }
    );
    return response;
  }

  /**
   * Check if CRE service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.request('/health', { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the endpoint URL
   */
  getEndpoint(): string {
    return this.config.endpoint;
  }

  /**
   * Get the target network
   */
  getNetwork(): EVMNetworkId {
    return this.config.network;
  }

  /**
   * Get the facilitator address
   */
  getFacilitatorAddress(): `0x${string}` {
    return this.config.facilitatorAddress;
  }

  /**
   * Check if running in simulation mode
   */
  isSimulation(): boolean {
    return this.config.simulation ?? false;
  }

  /**
   * Get the environment (staging/production)
   */
  getEnvironment(): 'staging' | 'production' {
    return this.config.environment ?? 'staging';
  }

  // Private Methods

  /**
   * Build workflow request from payment payload
   */
  private buildWorkflowRequest(
    action: CREWorkflowAction,
    payload: PaymentPayload
  ): CREWorkflowRequest {
    const authorization: CREPaymentAuthorization = {
      from: payload.payload.authorization.from,
      to: payload.payload.authorization.to,
      amount: payload.payload.authorization.amount,
      token: payload.payload.authorization.token,
      nonce: payload.payload.authorization.nonce,
      validUntil: payload.payload.authorization.validUntil,
      chainId: payload.payload.authorization.chainId,
    };

    const request: CREWorkflowRequest = {
      action,
      signature: payload.payload.signature,
      authorization,
    };

    if (payload.payload.permit) {
      request.permit = payload.payload.permit;
    }

    return request;
  }

  /**
   * Execute CRE workflow via HTTP trigger
   */
  private async executeWorkflow(
    request: CREWorkflowRequest
  ): Promise<CREWorkflowResponseExtended> {
    return this.request<CREWorkflowResponseExtended>('', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Make HTTP request to CRE endpoint
   */
  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const url = `${this.config.endpoint}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.timeout ?? 30000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Request-Id': `x402-${++this.requestId}-${Date.now()}`,
      };

      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      if (this.config.workflowId) {
        headers['X-Workflow-Id'] = this.config.workflowId;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers as Record<string, string>),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw err.network(
          `CRE workflow request failed: ${response.status} ${response.statusText}`,
          undefined,
          {
            status: response.status,
            statusText: response.statusText,
            body: errorBody,
            url,
          }
        );
      }

      const data: unknown = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw err.timeout(this.config.timeout ?? 30000);
      }
      if (isX402Error(error)) {
        throw error;
      }
      throw wrapUnknown(error, 'ENETWORK', 'CRE workflow request failed');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extract error message from CRE response error
   */
  private extractErrorMessage(error: CREWorkflowResponse['error']): string {
    if (!error) return 'cre_workflow_failed';
    if (typeof error === 'string') return error;
    return error.message || error.code || 'cre_workflow_failed';
  }

  /**
   * Map CRE response to VerifyResponse
   */
  private mapVerificationResponse(
    response: CREWorkflowResponse
  ): VerifyResponse {
    if (!response.success || !response.verification) {
      const errorMsg = this.extractErrorMessage(response.error);
      return {
        isValid: false,
        invalidReason: errorMsg as VerifyResponse['invalidReason'],
        details: {
          error: errorMsg,
        },
      };
    }

    const verification = response.verification;

    return {
      isValid: verification.isValid,
      invalidReason: (verification.reason ||
        verification.invalidReason) as VerifyResponse['invalidReason'],
      payer: verification.payer,
      details: {
        balance: verification.balance,
        allowance: verification.allowance,
      },
    };
  }

  /**
   * Map CRE response to SettleResponse
   */
  private mapSettlementResponse(
    response: CREWorkflowResponse,
    requirements: PaymentRequirements
  ): SettleResponse {
    if (!response.success || !response.settlement) {
      return {
        success: false,
        errorReason: this.extractErrorMessage(response.error),
        transaction: '',
        network: requirements.network,
        workflowId: response.executionId,
      };
    }

    const settlement = response.settlement;

    return {
      success: settlement.reportSubmitted,
      transaction: (settlement.txHash ??
        settlement.transactionHash ??
        '') as `0x${string}`,
      network: requirements.network,
      status:
        settlement.status ??
        (settlement.reportSubmitted ? 'pending' : 'failed'),
      workflowId: response.executionId,
      errorReason: settlement.error,
    };
  }

  /**
   * Simulate verification using CRE CLI
   *
   * This spawns the actual CRE workflow simulate command to ensure
   * simulation behavior matches production deployment.
   */
  private async simulateVerify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _client: PublicClient<HttpTransport, Chain>
  ): Promise<VerifyResponse> {
    const request = this.buildWorkflowRequest('verify', payload);

    request.requirements = {
      network: requirements.network,
      amount: requirements.amount,
      asset: requirements.asset,
      payTo: requirements.payTo,
    };

    const response = await executeCREWorkflow(this.buildCLIConfig(), request);

    return this.mapVerificationResponse(response);
  }

  /**
   * Simulate settlement using CRE CLI
   *
   * This spawns the actual CRE workflow simulate command.
   * If broadcastInSimulation is true, real transactions will be submitted.
   */
  private async simulateSettle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _client: PublicClient<HttpTransport, Chain>
  ): Promise<SettleResponse> {
    const request = this.buildWorkflowRequest('settle', payload);

    request.requirements = {
      network: requirements.network,
      amount: requirements.amount,
      asset: requirements.asset,
      payTo: requirements.payTo,
    };

    const response = await executeCREWorkflow(this.buildCLIConfig(), request);

    return this.mapSettlementResponse(response, requirements);
  }

  /**
   * Simulate verify and settle using CRE CLI in a single workflow execution
   */
  private async simulateVerifyAndSettle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<CREWorkflowResponse> {
    const request = this.buildWorkflowRequest('verify_and_settle', payload);

    request.requirements = {
      network: requirements.network,
      amount: requirements.amount,
      asset: requirements.asset,
      payTo: requirements.payTo,
    };

    return executeCREWorkflow(this.buildCLIConfig(), request);
  }

  /**
   * Build CLI configuration from client configuration
   */
  private buildCLIConfig(): import('./cli-executor.js').CRECLIConfig {
    return {
      workflowPath: this.config.workflowPath ?? './x402-workflow',
      target: this.config.targetSettings ?? 'staging-settings',
      timeout: this.config.timeout ?? 60000,
      broadcast: this.config.broadcastInSimulation ?? false,
      engineLogs: this.config.engineLogs ?? false,
    };
  }
}

/**
 * Create a CRE client instance
 *
 * @param config - Client configuration
 * @returns Configured CRE client
 */
export function createCREClient(config: CREClientConfig): CREClient {
  return new CREClient(config);
}

/**
 * Create a CRE client with default endpoint for a network
 *
 * @param network - Network identifier (e.g., 'eip155:84532' for Base Sepolia)
 * @param options - Additional options
 * @returns Configured CRE client
 */
export function createCREClientForNetwork(
  network: EVMNetworkId,
  options?: Partial<
    Omit<CREClientConfig, 'network' | 'endpoint' | 'facilitatorAddress'>
  >
): CREClient {
  const endpointConfig = DEFAULT_CRE_ENDPOINTS[network];

  if (!endpointConfig) {
    throw err.notFound(`Default CRE endpoint for network ${network}`);
  }

  return new CREClient({
    endpoint: endpointConfig.endpoint,
    facilitatorAddress: endpointConfig.facilitatorAddress,
    network,
    environment:
      endpointConfig.forwarderType === 'mock' ? 'staging' : 'production',
    ...options,
  });
}

/**
 * Simulation client configuration options
 */
export interface SimulationClientOptions {
  /** Path to the x402-workflow folder (default: "./x402-workflow") */
  workflowPath?: string;
  /** CRE target settings from workflow.yaml (default: "staging-settings") */
  targetSettings?: string;
  /** Enable --broadcast for real transactions (default: false) */
  broadcastInSimulation?: boolean;
  /** Enable CRE engine logs for debugging (default: false) */
  engineLogs?: boolean;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** API key (not used in simulation mode) */
  apiKey?: string;
}

/**
 * Create a CRE client for simulation mode
 *
 * @param network - Network identifier
 * @param facilitatorAddress - X402Facilitator contract address
 * @param options - Simulation options (workflow path, target settings, etc.)
 * @returns Configured CRE client in simulation mode
 *
 * @example
 * ```typescript
 * const client = createSimulationClient('eip155:84532', '0xea52...', {
 *   workflowPath: './x402-workflow',
 *   targetSettings: 'staging-settings',
 * });
 *
 * // This will spawn: cre workflow simulate ./x402-workflow --target staging-settings ...
 * const result = await client.verify(payload, requirements);
 * ```
 */
export function createSimulationClient(
  network: EVMNetworkId,
  facilitatorAddress: `0x${string}` = '0x0000000000000000000000000000000000000000',
  options?: SimulationClientOptions
): CREClient {
  return new CREClient({
    endpoint: 'cli://simulation',
    network,
    facilitatorAddress,
    simulation: true,
    environment: 'staging',
    workflowPath: options?.workflowPath ?? resolveDefaultWorkflowPath(),
    targetSettings: options?.targetSettings ?? 'staging-settings',
    broadcastInSimulation: options?.broadcastInSimulation ?? false,
    engineLogs: options?.engineLogs ?? false,
    timeout: options?.timeout ?? 60000,
    apiKey: options?.apiKey,
  });
}

/**
 * Resolve the default workflow path.
 */
function resolveDefaultWorkflowPath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return resolve(dirname(thisFile), '../../x402-workflow');
}

/**
 * Get endpoint configuration for a network
 *
 * @param network - Network identifier
 * @returns Endpoint configuration or undefined
 */
export function getEndpointConfig(
  network: EVMNetworkId
): CREEndpointConfig | undefined {
  return DEFAULT_CRE_ENDPOINTS[network];
}
