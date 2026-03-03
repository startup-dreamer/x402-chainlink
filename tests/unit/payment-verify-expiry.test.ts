/**
 * Test suite for validUntil timestamp checking in payment verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { PublicClient } from 'viem';

describe('Payment Verification: validUntil Expiry Checks', () => {
  const USDC_ADDRESS =
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`;
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
  const PAYER_ADDRESS =
    '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`;

  const baseRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: USDC_ADDRESS,
    payTo: RECIPIENT_ADDRESS,
    resource: 'https://api.example.com/data',
    maxTimeoutSeconds: 60,
  };

  let mockClient: PublicClient;

  beforeEach(() => {
    // Mock client with sufficient balance
    mockClient = {
      readContract: vi.fn().mockResolvedValue(BigInt('1000000')), // Balance: 1M (exact match)
    } as unknown as PublicClient;
  });

  describe('Valid (non-expired) payments', () => {
    it('should accept payment with validUntil far in the future', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.invalidReason).toBeUndefined();
    });

    it('should accept payment with validUntil exactly at current time', async () => {
      const currentTimestamp = Math.floor(Date.now() / 1000);

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: currentTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should accept payment with very large validUntil timestamp', async () => {
      // Far future: year 2100
      const farFutureTimestamp = '4102444800';

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: farFutureTimestamp,
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });
  });

  describe('Expired payments', () => {
    it('should reject payment with validUntil in the past', async () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: pastTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('payment_expired');
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.details?.validUntil).toBe(pastTimestamp.toString());
      expect(result.details?.currentTimestamp).toBeDefined();
    });

    it('should reject payment that expired 1 second ago', async () => {
      const justExpired = Math.floor(Date.now() / 1000) - 1;

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: justExpired.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('payment_expired');
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should accept payment with validUntil = 0 (no expiration)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: '0',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // validUntil = 0 means no expiration, so payment should be valid
      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
    });

    it('should reject payment with validUntil = 1 (very old timestamp)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: '1',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('payment_expired');
    });
  });

  describe('Invalid validUntil formats', () => {
    it('should reject payment with non-numeric validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: 'invalid',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // Schema validation catches this before timestamp check
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      expect(result.payer).toBeUndefined(); // Schema validation fails before extracting payer
      expect(result.details?.error).toBeDefined();
    });

    it('should reject payment with empty validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: '',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // Schema validation catches empty string
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
      expect(result.details?.error).toBeDefined();
    });

    it('should reject payment with negative validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: '-1',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // Schema validation catches negative numbers (regex requires digits only, no minus sign)
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject payment with floating point validUntil (caught by schema)', async () => {
      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: '123.456',
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // Schema validation catches decimal point (regex requires digits only)
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });
  });

  describe('Edge cases', () => {
    it('should handle very small time windows correctly', async () => {
      // Create a payment that expires in 2 seconds
      const shortExpiry = Math.floor(Date.now() / 1000) + 2;

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: shortExpiry.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      // Should still be valid if checked immediately
      expect(result.isValid).toBe(true);
    });

    it('should include timestamp details in expired payment response', async () => {
      const expiredTimestamp = 1000000; // Very old timestamp

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: expiredTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('payment_expired');
      expect(result.details).toBeDefined();
      expect(result.details?.validUntil).toBe(expiredTimestamp.toString());
      expect(result.details?.currentTimestamp).toBeDefined();

      // Verify current timestamp is reasonable
      const currentTimestamp = parseInt(
        result.details?.currentTimestamp as string,
        10
      );
      expect(currentTimestamp).toBeGreaterThan(expiredTimestamp);
      expect(currentTimestamp).toBeGreaterThan(1700000000); // After 2023
    });
  });

  describe('Integration with other validations', () => {
    it('should check validUntil before balance check', async () => {
      // Create expired payment with insufficient balance
      const expiredTimestamp = Math.floor(Date.now() / 1000) - 3600;

      const insufficientBalanceClient = {
        readContract: vi.fn().mockResolvedValue(BigInt('0')), // 0 balance (insufficient)
      } as unknown as PublicClient;

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: expiredTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(
        insufficientBalanceClient,
        payload,
        baseRequirements
      );

      // Should fail with 'expired' not 'insufficient_funds'
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('payment_expired');
    });

    it('should accept valid payment with all checks passing', async () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

      const payload: PaymentPayload = {
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const result = await verifyPayment(mockClient, payload, baseRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(PAYER_ADDRESS);
      expect(result.details?.balance).toBe('1000000');
    });
  });
});
