/**
 * Payment verification functions for EVM with EIP-712
 */

import type { PublicClient, Chain, HttpTransport } from 'viem';
import { recoverTypedDataAddress, verifyTypedData } from 'viem';
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  EIP712TypedData,
} from '../types/index.js';
import { PAYMENT_PAYLOAD_SCHEMA } from '../types/schemas.js';
import { addressesEqual } from '../utils/encoding.js';
import { getTokenBalance, getTokenAllowance } from '../utils/token.js';
import { X402_EIP712_TYPES } from '../types/payment.js';
import { getChainId as getChainIdFromNetwork } from '../types/network.js';

/**
 * Verify payment payload without executing the transaction
 *
 * @param client - Viem public client for on-chain checks
 * @param payload - Payment payload from client
 * @param paymentRequirements - Payment requirements from server
 * @returns Verification result
 *
 * @example
 * ```typescript
 * const result = await verifyPayment(client, payload, requirements);
 * if (result.isValid) {
 *   // Proceed with settlement
 * } else {
 *   console.error('Invalid payment:', result.invalidReason);
 * }
 * ```
 */
export async function verifyPayment(
  client: PublicClient<HttpTransport, Chain>,
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  try {
    const validationResult = PAYMENT_PAYLOAD_SCHEMA.safeParse(payload);
    if (!validationResult.success) {
      return {
        isValid: false,
        invalidReason: 'invalid_payload',
        details: {
          error: validationResult.error.message,
        },
      };
    }

    const payer = extractPayerAddress(payload);

    if (payload.accepted.network !== paymentRequirements.network) {
      return {
        isValid: false,
        invalidReason: 'invalid_network',
        payer,
      };
    }

    const expectedChainId = getChainIdFromNetwork(paymentRequirements.network);
    if (payload.payload.authorization.chainId !== expectedChainId) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_chain_id_mismatch',
        payer,
      };
    }

    const payloadToken = payload.payload.authorization.token;
    const requirementToken = paymentRequirements.asset;

    if (!payloadToken || !requirementToken) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_token_mismatch',
        payer,
      };
    }

    if (!addressesEqual(payloadToken, requirementToken)) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_token_mismatch',
        payer,
      };
    }

    // Verify authorization recipient matches requirement
    if (
      !addressesEqual(
        payload.payload.authorization.to,
        paymentRequirements.payTo
      )
    ) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_recipient_mismatch',
        payer,
      };
    }

    if (payload.payload.authorization.amount !== paymentRequirements.amount) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_authorization_value',
        payer,
      };
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const validUntil = parseInt(payload.payload.authorization.validUntil, 10);

    if (isNaN(validUntil)) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_authorization_valid_until',
        payer,
        details: {
          error: 'Invalid validUntil timestamp format',
        },
      };
    }

    // validUntil of 0 means "never expires"
    if (validUntil !== 0 && currentTimestamp > validUntil) {
      return {
        isValid: false,
        invalidReason: 'invalid_exact_evm_payload_authorization_valid_until',
        payer,
        details: {
          validUntil: validUntil.toString(),
          currentTimestamp: currentTimestamp.toString(),
        },
      };
    }

    if (payload.typedData) {
      const typedData = payload.typedData as EIP712TypedData;

      try {
        // Recover the signer from the signature
        const recoveredAddress = await recoverTypedDataAddress({
          domain: typedData.domain,
          types: {
            PaymentAuthorization: X402_EIP712_TYPES.PaymentAuthorization,
          },
          primaryType: 'PaymentAuthorization',
          message: typedData.message,
          signature: payload.payload.signature as `0x${string}`,
        });

        // Verify the recovered address matches the claimed payer
        if (!addressesEqual(recoveredAddress, payer)) {
          return {
            isValid: false,
            invalidReason: 'invalid_exact_evm_payload_signature',
            payer,
            details: {
              error: `Signature recovery mismatch: expected ${payer}, got ${recoveredAddress}`,
            },
          };
        }
      } catch (error) {
        return {
          isValid: false,
          invalidReason: 'invalid_exact_evm_payload_signature',
          payer,
          details: {
            error:
              error instanceof Error
                ? error.message
                : 'Signature verification failed',
          },
        };
      }
    }

    const tokenAddress = paymentRequirements.asset as `0x${string}`;
    const balance = await getTokenBalance(client, tokenAddress, payer);

    if (BigInt(balance) < BigInt(paymentRequirements.amount)) {
      return {
        isValid: false,
        invalidReason: 'insufficient_funds',
        payer,
        details: {
          balance,
        },
      };
    }

    if (payload.typedData) {
      const typedData = payload.typedData as EIP712TypedData;
      const spender = typedData.domain.verifyingContract;

      if (spender && spender !== '0x0000000000000000000000000000000000000000') {
        const allowance = await getTokenAllowance(
          client,
          tokenAddress,
          payer,
          spender
        );

        if (BigInt(allowance) < BigInt(paymentRequirements.amount)) {
          return {
            isValid: false,
            invalidReason: 'insufficient_allowance',
            payer,
            details: {
              balance,
              allowance,
            },
          };
        }
      }
    }

    return {
      isValid: true,
      payer,
      details: {
        balance,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      isValid: false,
      invalidReason: 'unexpected_verify_error',
      details: {
        error: errorMessage,
      },
    };
  }
}

/**
 * Verify EIP-712 signature directly
 *
 * @param typedData - EIP-712 typed data
 * @param signature - Signature to verify
 * @param expectedSigner - Expected signer address
 * @returns True if signature is valid
 */
export async function verifySignature(
  typedData: EIP712TypedData,
  signature: `0x${string}`,
  expectedSigner: `0x${string}`
): Promise<boolean> {
  try {
    const isValid = await verifyTypedData({
      address: expectedSigner,
      domain: typedData.domain,
      types: { PaymentAuthorization: X402_EIP712_TYPES.PaymentAuthorization },
      primaryType: 'PaymentAuthorization',
      message: typedData.message,
      signature,
    });
    return isValid;
  } catch {
    return false;
  }
}

/**
 * Recover signer address from EIP-712 signature
 *
 * @param typedData - EIP-712 typed data
 * @param signature - Signature to recover from
 * @returns Recovered signer address
 */
export async function recoverSigner(
  typedData: EIP712TypedData,
  signature: `0x${string}`
): Promise<`0x${string}`> {
  return recoverTypedDataAddress({
    domain: typedData.domain,
    types: { PaymentAuthorization: X402_EIP712_TYPES.PaymentAuthorization },
    primaryType: 'PaymentAuthorization',
    message: typedData.message,
    signature,
  });
}

/**
 * Extract payer address from payment payload
 *
 * @param payload - Payment payload
 * @returns Payer address
 */
export function extractPayerAddress(payload: PaymentPayload): `0x${string}` {
  return payload.payload.authorization.from;
}
