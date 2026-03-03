/**
 * Security Test Suite: Amount Validation
 * Based on SECURITY_TESTING.md sections 3.1-3.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { PublicClient } from 'viem';

describe('Security: Amount Validation', () => {
  const USDC_ADDRESS =
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`;
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;

  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

  const basePayload: PaymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'eip155:8453',
      amount: '1000000',
      asset: USDC_ADDRESS,
      payTo: RECIPIENT_ADDRESS,
      maxTimeoutSeconds: 3600,
    },
    payload: {
      signature:
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
      authorization: {
        from: '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
        to: RECIPIENT_ADDRESS,
        amount: '1000000',
        token: USDC_ADDRESS,
        nonce: '1',
        validUntil: futureTimestamp.toString(),
        chainId: '8453',
      },
    },
  };

  let mockClient: PublicClient;

  beforeEach(() => {
    mockClient = {
      readContract: vi.fn().mockResolvedValue(BigInt('10000000')), // Sufficient balance
    } as unknown as PublicClient;
  });

  describe('3.1 Tampered Amount Detection', () => {
    it('should reject payment with tampered amount', async () => {
      const tamperedPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '500000', // Tampered: less than required
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        tamperedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should reject amount higher than required', async () => {
      const overpaidPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '2000000', // More than required
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        overpaidPayload,
        requirements
      );

      // For 'exact' scheme, even overpayment should be rejected
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should reject amount lower than required', async () => {
      const underpaidPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '999999', // Just 1 less
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        underpaidPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should enforce strict equality for amount matching', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(mockClient, basePayload, requirements);

      expect(result.isValid).toBe(true);
    });

    it('should accept exact amount match', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(mockClient, basePayload, requirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(basePayload.payload.authorization.from);
    });
  });

  describe('3.2 Integer Overflow Prevention', () => {
    it('should handle maximum u256 amount without overflow', async () => {
      const maxU256 =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935';

      const largePayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: maxU256,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: maxU256,
          },
        },
      };

      // Mock sufficient balance
      const largeBalanceClient = {
        readContract: vi.fn().mockResolvedValue(BigInt(maxU256)),
      } as unknown as PublicClient;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: maxU256,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      // Should handle large numbers without overflow
      const result = await verifyPayment(
        largeBalanceClient,
        largePayload,
        requirements
      );

      // May fail for other reasons but should not crash
      expect(result).toBeDefined();
    });

    it('should handle very large numbers correctly', async () => {
      const largeAmount = '999999999999999999999999999999999'; // Very large but not max

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: largeAmount,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const largePayload: PaymentPayload = {
        ...basePayload,
        accepted: {
          ...basePayload.accepted,
          amount: largeAmount,
        },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: largeAmount,
          },
        },
      };

      // Should handle without overflow
      const result = await verifyPayment(
        mockClient,
        largePayload,
        requirements
      );

      // Will fail due to insufficient balance
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('insufficient_balance');
    });

    it('should correctly compare large amounts that differ slightly', async () => {
      const largeAmount1 = '1000000000000000000000000000000000';
      const largeAmount2 = '1000000000000000000000000000000001'; // 1 more

      const payload1: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: largeAmount1 },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: largeAmount2, // Mismatch
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: largeAmount1,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(mockClient, payload1, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should handle amounts near u128 boundary', async () => {
      // 2^128 boundary
      const nearU128 = '340282366920938463463374607431768211455';

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: nearU128,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const largePayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: nearU128 },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: nearU128,
          },
        },
      };

      const result = await verifyPayment(
        mockClient,
        largePayload,
        requirements
      );

      // Should handle without overflow (will fail for insufficient balance)
      expect(result).toBeDefined();
    });

    it('should handle amounts above u128 boundary', async () => {
      // Just above 2^128
      const aboveU128 = '340282366920938463463374607431768211456';

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: aboveU128,
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const largePayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: aboveU128 },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: aboveU128,
          },
        },
      };

      const result = await verifyPayment(
        mockClient,
        largePayload,
        requirements
      );

      // Should handle without overflow
      expect(result).toBeDefined();
    });
  });

  describe('3.3 Zero Amount Handling', () => {
    it('should accept zero amount when required', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const zeroPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '0' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0',
          },
        },
      };

      const result = await verifyPayment(mockClient, zeroPayload, requirements);

      // Zero amount for free resources should be valid
      expect(result.isValid).toBe(true);
    });

    it('should reject non-zero amount when zero required', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const nonZeroPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '0' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1', // Paying when should be free
          },
        },
      };

      const result = await verifyPayment(
        mockClient,
        nonZeroPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should reject zero amount when non-zero required', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const zeroPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '1000000' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0', // Not paying
          },
        },
      };

      const result = await verifyPayment(mockClient, zeroPayload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });

    it('should handle zero amount with zero balance', async () => {
      const zeroBalanceClient = {
        readContract: vi.fn().mockResolvedValue(BigInt(0)),
      } as unknown as PublicClient;

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '0',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const zeroPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '0' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '0',
          },
        },
      };

      const result = await verifyPayment(
        zeroBalanceClient,
        zeroPayload,
        requirements
      );

      // Zero amount should be valid even with zero balance
      expect(result.isValid).toBe(true);
    });
  });

  describe('Amount Format Validation', () => {
    it('should handle amount with leading zeros', () => {
      // Leading zeros in strings should be handled correctly
      const amount = '001000000'; // With leading zeros

      // BigInt will parse this correctly
      expect(BigInt(amount)).toBe(BigInt(1000000));
    });

    it('should handle amount in hexadecimal format', () => {
      // Some systems might use hex
      const hexAmount = '0xf4240'; // 1000000 in hex

      expect(BigInt(hexAmount)).toBe(BigInt(1000000));
    });

    it('should reject negative amount strings', async () => {
      const negativePayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '-1000000', // Negative
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        negativePayload,
        requirements
      );

      // Schema should reject negative amounts
      expect(result.isValid).toBe(false);
    });

    it('should reject non-numeric amount strings', async () => {
      const invalidPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: 'one million', // Not numeric
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        invalidPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject floating point amounts', async () => {
      const floatPayload: PaymentPayload = {
        ...basePayload,
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1000000.5', // Floating point
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        floatPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });
  });

  describe('Cross-field Amount Verification', () => {
    it('should verify amount matches across all fields', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const matchingPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '1000000' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '1000000',
          },
        },
      };

      const result = await verifyPayment(
        mockClient,
        matchingPayload,
        requirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject if authorization amount differs from requirement', async () => {
      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const mismatchPayload: PaymentPayload = {
        ...basePayload,
        accepted: { ...basePayload.accepted, amount: '1000000' },
        payload: {
          ...basePayload.payload,
          authorization: {
            ...basePayload.payload.authorization,
            amount: '999999', // Doesn't match
          },
        },
      };

      const result = await verifyPayment(
        mockClient,
        mismatchPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('amount_mismatch');
    });
  });
});
