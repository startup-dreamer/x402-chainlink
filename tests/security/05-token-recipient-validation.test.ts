/**
 * Security Test Suite: Token and Recipient Validation
 * Tests token address and recipient validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { PublicClient } from 'viem';

describe('Security: Token and Recipient Validation', () => {
  const USDC_ADDRESS =
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`;
  const LINK_ADDRESS =
    '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196' as `0x${string}`;
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
  const PAYER_ADDRESS =
    '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`;
  const ATTACKER_ADDRESS =
    '0x9999999999999999999999999999999999999999' as `0x${string}`;

  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

  let mockClient: PublicClient;

  beforeEach(() => {
    mockClient = {
      readContract: vi.fn().mockResolvedValue(BigInt('10000000')),
    } as unknown as PublicClient;
  });

  describe('Token Validation', () => {
    it('should reject payment with wrong token address', async () => {
      const wrongTokenPayload: PaymentPayload = {
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
            token: LINK_ADDRESS, // Wrong token!
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS, // Expects USDC
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        wrongTokenPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('token_mismatch');
    });

    it('should accept payment with correct token', async () => {
      const correctPayload: PaymentPayload = {
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
        correctPayload,
        requirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject token with wrong checksum', async () => {
      // Invalid checksum address
      const invalidChecksumAddress =
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02914' as `0x${string}`; // Last digit changed

      const invalidPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: invalidChecksumAddress,
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
            token: invalidChecksumAddress,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
    });

    it('should reject malformed token address', async () => {
      const malformedPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          // @ts-expect-error testing malformed address
          asset: '0xinvalid',
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
            // @ts-expect-error testing malformed address
            token: '0xinvalid',
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject empty token address', async () => {
      const emptyTokenPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          // @ts-expect-error testing empty address
          asset: '',
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
            // @ts-expect-error testing empty address
            token: '',
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        emptyTokenPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject zero address as token', async () => {
      const zeroAddressPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
            token:
              '0x0000000000000000000000000000000000000000' as `0x${string}`,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        zeroAddressPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('Recipient Validation', () => {
    it('should reject payment with wrong recipient address', async () => {
      const wrongRecipientPayload: PaymentPayload = {
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
            to: ATTACKER_ADDRESS, // Wrong recipient!
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        wrongRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('recipient_mismatch');
    });

    it('should accept payment with correct recipient', async () => {
      const correctPayload: PaymentPayload = {
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
        correctPayload,
        requirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject recipient with wrong checksum', async () => {
      // Invalid checksum address
      const invalidRecipient =
        '0x1234567890abcdef1234567890abcdef12345679' as `0x${string}`; // Last digit changed

      const invalidPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: invalidRecipient,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: invalidRecipient,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
    });

    it('should reject malformed recipient address', async () => {
      const malformedPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          // @ts-expect-error testing malformed address
          payTo: '0xinvalid',
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            // @ts-expect-error testing malformed address
            to: '0xinvalid',
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        malformedPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject empty recipient address', async () => {
      const emptyRecipientPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          // @ts-expect-error testing empty address
          payTo: '',
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            // @ts-expect-error testing empty address
            to: '',
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        emptyRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should reject zero address as recipient', async () => {
      const zeroRecipientPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: '0x0000000000000000000000000000000000000000' as `0x${string}`,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: '0x0000000000000000000000000000000000000000' as `0x${string}`,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        zeroRecipientPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject payment to self (payer = recipient)', async () => {
      const selfPayPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: PAYER_ADDRESS, // Same as from
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: PAYER_ADDRESS, // Same as from
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        selfPayPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should handle addresses with leading zeros', async () => {
      const leadingZerosAddress =
        '0x0000000000000000000000000000000012345678' as `0x${string}`;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: leadingZerosAddress,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: leadingZerosAddress,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: leadingZerosAddress,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(mockClient, payload, requirements);

      // Should work if all other checks pass
      expect(result.isValid).toBe(true);
    });
  });

  describe('Address Normalization', () => {
    it('should normalize address comparison', async () => {
      // Same address, different case
      const lowerCase =
        '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
      const mixedCase =
        '0x1234567890ABCDEF1234567890abcdef12345678' as `0x${string}`;

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: mixedCase,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: mixedCase,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: lowerCase, // Different case
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(mockClient, payload, requirements);

      // Should normalize and accept (case-insensitive comparison)
      expect(result.isValid).toBe(true);
    });
  });

  describe('Attack Scenarios', () => {
    it('should prevent attacker from redirecting payment to their address', async () => {
      const attackerPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS, // Claimed recipient
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12' as `0x${string}`,
          authorization: {
            from: PAYER_ADDRESS,
            to: ATTACKER_ADDRESS, // Actual destination is attacker!
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        attackerPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('recipient_mismatch');
    });

    it('should prevent attacker from using wrong token to drain different asset', async () => {
      const tokenSwapPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: USDC_ADDRESS, // Claims USDC
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
            token: LINK_ADDRESS, // Actually using LINK!
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453',
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
        tokenSwapPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('token_mismatch');
    });
  });
});
