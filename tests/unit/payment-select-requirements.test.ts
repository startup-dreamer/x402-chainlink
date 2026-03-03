/**
 * Tests for selectPaymentRequirements function
 */

import { describe, it, expect, vi } from 'vitest';
import { selectPaymentRequirements } from '../../src/payment/create.js';
import type { PaymentRequirements } from '../../src/types/index.js';
import type { PublicClient, Account } from 'viem';

describe('selectPaymentRequirements', () => {
  const mockAccount = {
    address: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
    type: 'local',
  } as Account;

  describe('Network Compatibility', () => {
    it('should select requirement matching account network', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:1', // Ethereum mainnet
          amount: '1000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`, // USDC
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'eip155:8453', // Base mainnet
          amount: '500000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`, // USDC on Base
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453), // Base mainnet
        readContract: vi.fn().mockResolvedValue(BigInt('1000000000')), // Sufficient balance
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.network).toBe('eip155:8453');
      expect(selected.amount).toBe('500000');
    });

    it('should throw when no compatible network found', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:1', // Ethereum mainnet
          amount: '1000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      // Client is connected to a different network (Polygon)
      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(137), // Polygon
        readContract: vi.fn().mockResolvedValue(BigInt('0')),
      } as unknown as PublicClient;

      await expect(
        selectPaymentRequirements(requirements, mockAccount, mockClient)
      ).rejects.toThrow();
    });

    it('should recognize mainnet chain ID', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:1', // Ethereum mainnet
          amount: '1000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(1), // Ethereum mainnet
        readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.network).toBe('eip155:1');
    });

    it('should default to sepolia when getChainId fails', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:11155111', // Sepolia testnet
          amount: '1000000',
          asset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockRejectedValue(new Error('RPC error')),
        readContract: vi.fn().mockResolvedValue(BigInt('1000000000')),
      } as unknown as PublicClient;

      // Should fall back to checking by balance
      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.network).toBe('eip155:11155111');
    });
  });

  describe('Balance Checks', () => {
    it('should select requirement with sufficient balance', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('2000000')), // More than required
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.amount).toBe('1000000');
    });

    it('should throw when no requirement has sufficient balance', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000000000', // Very large amount
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('100')), // Insufficient balance
      } as unknown as PublicClient;

      await expect(
        selectPaymentRequirements(requirements, mockAccount, mockClient)
      ).rejects.toThrow();
    });

    it('should handle balance check errors gracefully', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi
          .fn()
          .mockRejectedValue(new Error('Balance check failed')),
      } as unknown as PublicClient;

      // Should still select if balance check fails (might be allowed in some cases)
      await expect(
        selectPaymentRequirements(requirements, mockAccount, mockClient)
      ).rejects.toThrow();
    });

    it('should prefer lower cost when multiple options available', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '2000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000', // Lower cost
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('5000000')), // Enough for both
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.amount).toBe('1000000');
    });

    it('should prefer shorter timeout when costs are equal', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 600, // Longer timeout
        },
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300, // Shorter timeout
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('5000000')),
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.maxTimeoutSeconds).toBe(300);
    });
  });

  describe('Edge Cases', () => {
    it('should throw when requirements array is empty', async () => {
      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn(),
      } as unknown as PublicClient;

      await expect(
        selectPaymentRequirements([], mockAccount, mockClient)
      ).rejects.toThrow();
    });

    it('should handle single requirement', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('5000000')),
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected).toEqual(requirements[0]);
    });

    it('should handle very large amounts', async () => {
      const largeAmount =
        '115792089237316195423570985008687907853269984665640564039457584007913129639935'; // max uint256

      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: largeAmount,
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt(largeAmount)),
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.amount).toBe(largeAmount);
    });

    it('should select cheapest among multiple networks and tokens', async () => {
      const requirements: Array<PaymentRequirements> = [
        {
          scheme: 'exact',
          network: 'eip155:1',
          amount: '3000000',
          asset: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000', // Cheapest
          asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
        {
          scheme: 'exact',
          network: 'eip155:137',
          amount: '2000000',
          asset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as `0x${string}`,
          payTo: '0x1234567890abcdef1234567890abcdef12345678' as `0x${string}`,
          resource: 'https://api.example.com/data',
          maxTimeoutSeconds: 300,
        },
      ];

      const mockClient = {
        getChainId: vi.fn().mockResolvedValue(8453),
        readContract: vi.fn().mockResolvedValue(BigInt('5000000')),
      } as unknown as PublicClient;

      const selected = await selectPaymentRequirements(
        requirements,
        mockAccount,
        mockClient
      );

      expect(selected.amount).toBe('1000000');
      expect(selected.network).toBe('eip155:8453');
    });
  });
});
