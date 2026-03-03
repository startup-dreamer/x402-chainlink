/**
 * Security Test Suite: Network Validation
 * Tests cross-network payment rejection and network spoofing prevention
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPayment } from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';
import type { PublicClient } from 'viem';

describe('Security: Network Validation', () => {
  const USDC_ADDRESS =
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`;
  const RECIPIENT_ADDRESS =
    '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`;
  const PAYER_ADDRESS =
    '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`;

  const futureTimestamp = Math.floor(Date.now() / 1000) + 3600;

  let mockClient: PublicClient;

  beforeEach(() => {
    mockClient = {
      readContract: vi.fn().mockResolvedValue(BigInt('10000000')), // Sufficient balance
    } as unknown as PublicClient;
  });

  describe('Cross-Network Payment Rejection', () => {
    it('should reject cross-network payment (sepolia -> mainnet)', async () => {
      const sepoliaPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:11155111', // Sepolia
          amount: '1000000',
          asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`, // Sepolia USDC
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
              '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '11155111', // Sepolia chain ID
          },
        },
      };

      const mainnetRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:1', // Mainnet
        amount: '1000000',
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`, // Mainnet USDC
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        sepoliaPayload,
        mainnetRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('network_mismatch');
    });

    it('should reject cross-network payment (mainnet -> sepolia)', async () => {
      const mainnetPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:1', // Mainnet
          amount: '1000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
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
              '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '1', // Mainnet chain ID
          },
        },
      };

      const sepoliaRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:11155111', // Sepolia
        amount: '1000000',
        asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        mainnetPayload,
        sepoliaRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('network_mismatch');
    });

    it('should accept matching networks (sepolia -> sepolia)', async () => {
      const sepoliaPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:11155111',
          amount: '1000000',
          asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
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
              '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '11155111',
          },
        },
      };

      const sepoliaRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:11155111',
        amount: '1000000',
        asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        sepoliaPayload,
        sepoliaRequirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should accept matching networks (mainnet -> mainnet)', async () => {
      const mainnetPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:1',
          amount: '1000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
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
              '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '1',
          },
        },
      };

      const mainnetRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:1',
        amount: '1000000',
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        mainnetPayload,
        mainnetRequirements
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject devnet payment on mainnet requirements', async () => {
      const devnetPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          network: 'eip155:31337', // Local devnet
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
            chainId: '31337',
          },
        },
      };

      const mainnetRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:1',
        amount: '1000000',
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        devnetPayload,
        mainnetRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('network_mismatch');
    });
  });

  describe('Invalid Network Values', () => {
    it('should reject unsupported network name', async () => {
      const invalidPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing invalid network
          network: 'unsupported:network',
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
            chainId: '999999',
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

    it('should reject empty network name', async () => {
      const emptyNetworkPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing empty network
          network: '',
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
        emptyNetworkPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject null network', async () => {
      const nullNetworkPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing null network
          network: null,
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
        nullNetworkPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject network with wrong case', async () => {
      const wrongCasePayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing wrong case
          network: 'EIP155:8453', // Wrong case
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
        wrongCasePayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should reject ethereum network', async () => {
      const invalidFormatPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing invalid format
          network: 'ethereum:mainnet', // Invalid format
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
            chainId: '1',
          },
        },
      };

      const requirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:1',
        amount: '1000000',
        asset: USDC_ADDRESS,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        invalidFormatPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });

    it('should handle network field missing from payload (v2: missing accepted field)', async () => {
      const missingNetworkPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // network is missing
          amount: '1000000',
          asset: USDC_ADDRESS,
          payTo: RECIPIENT_ADDRESS,
          maxTimeoutSeconds: 3600,
        },
        payload: {
          signature:
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
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
        missingNetworkPayload as PaymentPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_payload');
    });

    it('should handle undefined network', async () => {
      const undefinedNetworkPayload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: 'exact',
          // @ts-expect-error testing undefined network
          network: undefined,
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
        undefinedNetworkPayload,
        requirements
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe('Replay Attack Prevention', () => {
    it('should prevent replay attack across networks', async () => {
      // Same payload used for both sepolia and mainnet should fail
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
            from: PAYER_ADDRESS,
            to: RECIPIENT_ADDRESS,
            amount: '1000000',
            token: USDC_ADDRESS,
            nonce: '1',
            validUntil: futureTimestamp.toString(),
            chainId: '8453', // Base chain ID
          },
        },
      };

      // Try to use Base payload on Ethereum mainnet
      const mainnetRequirements: PaymentRequirements = {
        scheme: 'exact',
        network: 'eip155:1', // Mainnet
        amount: '1000000',
        asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
        payTo: RECIPIENT_ADDRESS,
        resource: 'https://api.example.com/data',
        maxTimeoutSeconds: 60,
      };

      const result = await verifyPayment(
        mockClient,
        basePayload,
        mainnetRequirements
      );

      // Should reject due to network mismatch
      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('network_mismatch');
    });
  });
});
