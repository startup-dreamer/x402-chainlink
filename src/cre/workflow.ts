/**
 * CRE Workflow Implementation
 *
 * This module contains the workflow logic that runs on the Chainlink DON.
 * It handles payment verification and settlement with BFT consensus.
 */

import type {
  PublicClient,
  Chain,
  HttpTransport,
  WalletClient,
  Transport,
  Account,
} from 'viem';
import { encodeFunctionData } from 'viem';
import type {
  CREWorkflowRequest,
  CREWorkflowResponse,
  CREVerificationResult,
  CRESettlementResult,
  CREConsensusInfo,
  CREWorkflowAction,
} from './types.js';
import type { EIP712TypedData } from '../types/index.js';
import { recoverSigner } from '../payment/verify.js';
import { getTokenBalance, getTokenAllowance } from '../utils/token.js';
import { ERC20_ABI, ERC20_PERMIT_ABI } from '../tokens/index.js';
import { addressesEqual } from '../utils/encoding.js';

/**
 * CRE Workflow Handler
 */
export class CREWorkflowHandler {
  private executionCounter = 0;

  /**
   * Execute a workflow request
   */
  async execute(
    request: CREWorkflowRequest,
    client: PublicClient<HttpTransport, Chain>,
    walletClient?: WalletClient<Transport, Chain, Account>
  ): Promise<CREWorkflowResponse> {
    const executionId = this.generateExecutionId();
    const startTime = Date.now();

    try {
      let verification: CREVerificationResult | undefined;
      let settlement: CRESettlementResult | undefined;

      // Step 1: Verify (if action includes verification)
      if (
        request.action === 'verify' ||
        request.action === 'verify_and_settle'
      ) {
        verification = await this.executeVerification(request, client);

        // If verification fails and we need to settle, stop here
        if (!verification.isValid && request.action === 'verify_and_settle') {
          return this.buildResponse(
            executionId,
            request.action,
            false,
            startTime,
            verification,
            undefined,
            {
              code: 'verification_failed',
              message: verification.invalidReason ?? 'Unknown',
            }
          );
        }
      }

      // Step 2: Settle (if action includes settlement)
      if (
        request.action === 'settle' ||
        request.action === 'verify_and_settle'
      ) {
        if (!walletClient) {
          return this.buildResponse(
            executionId,
            request.action,
            false,
            startTime,
            verification,
            undefined,
            {
              code: 'no_wallet',
              message: 'Wallet client required for settlement',
            }
          );
        }

        settlement = await this.executeSettlement(
          request,
          client,
          walletClient
        );

        if (settlement.status === 'failed') {
          return this.buildResponse(
            executionId,
            request.action,
            false,
            startTime,
            verification,
            settlement,
            {
              code: 'settlement_failed',
              message: 'Transaction execution failed',
            }
          );
        }
      }

      return this.buildResponse(
        executionId,
        request.action,
        true,
        startTime,
        verification,
        settlement
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return this.buildResponse(
        executionId,
        request.action,
        false,
        startTime,
        undefined,
        undefined,
        { code: 'execution_error', message: errorMessage }
      );
    }
  }

  /**
   * Execute verification step
   */
  private async executeVerification(
    request: CREWorkflowRequest,
    client: PublicClient<HttpTransport, Chain>
  ): Promise<CREVerificationResult> {
    const { signature, authorization, typedData } = request;
    const requirements = request.requirements;

    // Guard: requirements must be provided for verification
    if (!requirements) {
      return {
        isValid: false,
        invalidReason: 'Missing requirements for verification',
        payer: authorization.from,
      };
    }

    // 1. Verify signature
    if (typedData) {
      try {
        const recoveredSigner = await recoverSigner(
          typedData as EIP712TypedData,
          signature
        );

        if (!addressesEqual(recoveredSigner, authorization.from)) {
          return {
            isValid: false,
            invalidReason: 'Signature does not match claimed payer',
            payer: authorization.from,
          };
        }
      } catch (error) {
        return {
          isValid: false,
          invalidReason: 'Invalid signature',
          payer: authorization.from,
        };
      }
    }

    // 2. Verify authorization matches requirements
    if (authorization.amount !== requirements.amount) {
      return {
        isValid: false,
        invalidReason: 'Amount mismatch',
        payer: authorization.from,
      };
    }

    if (!addressesEqual(authorization.to, requirements.payTo)) {
      return {
        isValid: false,
        invalidReason: 'Recipient mismatch',
        payer: authorization.from,
      };
    }

    // 3. Check expiration
    const currentTime = Math.floor(Date.now() / 1000);
    const validUntil = parseInt(authorization.validUntil, 10);
    if (validUntil !== 0 && currentTime > validUntil) {
      return {
        isValid: false,
        invalidReason: 'Payment authorization expired',
        payer: authorization.from,
      };
    }

    // 4. Check balance
    const balance = await getTokenBalance(
      client,
      requirements.asset as `0x${string}`,
      authorization.from
    );

    if (BigInt(balance) < BigInt(requirements.amount)) {
      return {
        isValid: false,
        invalidReason: 'Insufficient balance',
        payer: authorization.from,
        balance,
      };
    }

    // 5. Check allowance (for ERC-20 tokens)
    // Skip if permit is provided (permit will be executed atomically before transfer)
    let allowance: string | undefined;

    if (request.permit) {
      // Permit provided - skip allowance check
      // The permit will atomically set allowance and execute transfer
      allowance = 'permit_pending';
    } else if (requirements.asset !== null && typedData) {
      const spender = (typedData as EIP712TypedData).domain.verifyingContract;
      if (spender && spender !== '0x0000000000000000000000000000000000000000') {
        allowance = await getTokenAllowance(
          client,
          requirements.asset as `0x${string}`,
          authorization.from,
          spender
        );

        if (BigInt(allowance) < BigInt(requirements.amount)) {
          return {
            isValid: false,
            invalidReason: 'Insufficient allowance',
            payer: authorization.from,
            balance,
            allowance,
          };
        }
      }
    }

    return {
      isValid: true,
      payer: authorization.from,
      balance,
      allowance,
    };
  }

  /**
   * Execute settlement step
   */
  private async executeSettlement(
    request: CREWorkflowRequest,
    client: PublicClient<HttpTransport, Chain>,
    walletClient: WalletClient<Transport, Chain, Account>
  ): Promise<CRESettlementResult> {
    const { authorization, permit } = request;
    const requirements = request.requirements;

    // Guard: requirements must be provided for settlement
    if (!requirements) {
      return {
        reportSubmitted: false,
        transactionHash: `0x${'0'.repeat(64)}` as `0x${string}`,
        status: 'failed',
        error: 'Missing requirements for settlement',
      };
    }

    try {
      let txHash: `0x${string}`;

      if (requirements.asset === null) {
        // Native ETH transfer
        txHash = await walletClient.sendTransaction({
          to: requirements.payTo,
          value: BigInt(requirements.amount),
        });
      } else {
        // ERC-20 transfer with optional permit
        const tokenAddress = requirements.asset as `0x${string}`;
        const spenderAddress = walletClient.account.address;

        // If permit is provided, execute it first (gasless approval)
        if (permit) {
          const permitData = encodeFunctionData({
            abi: ERC20_PERMIT_ABI,
            functionName: 'permit',
            args: [
              authorization.from,
              spenderAddress,
              BigInt(requirements.amount),
              BigInt(permit.deadline),
              permit.v,
              permit.r,
              permit.s,
            ],
          });

          try {
            const permitTxHash = await walletClient.sendTransaction({
              to: tokenAddress,
              data: permitData,
            });

            // Wait for permit to be confirmed
            await client.waitForTransactionReceipt({
              hash: permitTxHash,
              timeout: 30_000,
            });
          } catch (permitError) {
            // Permit failed - check if allowance already exists
            const currentAllowance = await getTokenAllowance(
              client,
              tokenAddress,
              authorization.from,
              spenderAddress
            );

            if (BigInt(currentAllowance) < BigInt(requirements.amount)) {
              throw new Error(
                `Permit failed and insufficient allowance: ${currentAllowance} < ${requirements.amount}`
              );
            }
            // Allowance exists, continue with transfer
          }
        }

        // Execute ERC-20 transferFrom
        // Note: This requires the wallet to have allowance (from permit or prior approval)
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transferFrom',
          args: [
            authorization.from,
            requirements.payTo,
            BigInt(requirements.amount),
          ],
        });

        txHash = await walletClient.sendTransaction({
          to: tokenAddress,
          data,
        });
      }

      // Wait for transaction receipt
      const receipt = await client.waitForTransactionReceipt({
        hash: txHash,
        timeout: 60_000,
      });

      return {
        reportSubmitted: true,
        transactionHash: txHash,
        txHash: txHash,
        blockNumber: Number(receipt.blockNumber),
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 'success' ? 'confirmed' : 'failed',
      };
    } catch (error) {
      return {
        reportSubmitted: false,
        transactionHash: `0x${'0'.repeat(64)}` as `0x${string}`,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `cre-${Date.now()}-${++this.executionCounter}`;
  }

  /**
   * Build workflow response
   */
  private buildResponse(
    executionId: string,
    action: CREWorkflowAction,
    success: boolean,
    startTime: number,
    verification?: CREVerificationResult,
    settlement?: CRESettlementResult,
    error?: { code: string; message: string }
  ): CREWorkflowResponse {
    const durationMs = Date.now() - startTime;

    // In simulation, consensus is always "reached" with 1 node
    const consensus: CREConsensusInfo = {
      nodeCount: 1,
      reached: true,
      threshold: 1,
      timestamp: Date.now(),
    };

    return {
      success,
      executionId,
      action,
      verification,
      settlement,
      error,
      consensus,
      mode: 'simulation',
      durationMs,
    };
  }
}

/**
 * Create a workflow handler instance
 */
export function createWorkflowHandler(): CREWorkflowHandler {
  return new CREWorkflowHandler();
}

/**
 * Execute a workflow request (convenience function)
 */
export async function executeWorkflow(
  request: CREWorkflowRequest,
  client: PublicClient<HttpTransport, Chain>,
  walletClient?: WalletClient<Transport, Chain, Account>
): Promise<CREWorkflowResponse> {
  const handler = createWorkflowHandler();
  return handler.execute(request, client, walletClient);
}
