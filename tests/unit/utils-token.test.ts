import { describe, it, expect, vi } from 'vitest';
import { getTokenBalance, getTokenMetadata } from '../../src/utils/token.js';
import type { PublicClient } from 'viem';

describe('Token Utilities', () => {
  describe('getTokenBalance', () => {
    it('should handle bigint balance response', async () => {
      const mockClient = {
        readContract: vi.fn().mockResolvedValue(BigInt('1000000')),
      } as unknown as PublicClient;

      const balance = await getTokenBalance(
        mockClient,
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
        '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`
      );

      expect(balance).toBe('1000000');
      expect(mockClient.readContract).toHaveBeenCalled();
    });

    it('should handle large balance', async () => {
      const largeBalance = BigInt(
        '115792089237316195423570985008687907853269984665640564039457584007913129639935'
      );

      const mockClient = {
        readContract: vi.fn().mockResolvedValue(largeBalance),
      } as unknown as PublicClient;

      const balance = await getTokenBalance(
        mockClient,
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
        '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`
      );

      expect(balance).toBe(largeBalance.toString());
    });

    it('should handle zero balance', async () => {
      const mockClient = {
        readContract: vi.fn().mockResolvedValue(BigInt('0')),
      } as unknown as PublicClient;

      const balance = await getTokenBalance(
        mockClient,
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
        '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`
      );

      expect(balance).toBe('0');
    });

    it('should handle RPC error gracefully', async () => {
      const mockClient = {
        readContract: vi.fn().mockRejectedValue(new Error('RPC error')),
      } as unknown as PublicClient;

      await expect(
        getTokenBalance(
          mockClient,
          '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`,
          '0xabcdef1234567890abcdef1234567890abcdef12' as `0x${string}`
        )
      ).rejects.toThrow('RPC error');
    });
  });

  describe('getTokenMetadata', () => {
    it('should fetch token metadata', async () => {
      const mockClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce('USDC') // symbol
          .mockResolvedValueOnce(6), // decimals
      } as unknown as PublicClient;

      const metadata = await getTokenMetadata(
        mockClient,
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`
      );

      expect(metadata.symbol).toBe('USDC');
      expect(metadata.decimals).toBe(6);
    });

    it('should handle missing metadata values', async () => {
      const mockClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce('') // empty symbol
          .mockResolvedValueOnce(18), // decimals
      } as unknown as PublicClient;

      const metadata = await getTokenMetadata(
        mockClient,
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' as `0x${string}`
      );

      expect(metadata.symbol).toBe('');
      expect(metadata.decimals).toBe(18);
    });

    it('should convert decimals to number', async () => {
      const mockClient = {
        readContract: vi
          .fn()
          .mockResolvedValueOnce('LINK') // symbol
          .mockResolvedValueOnce(18n), // decimals as bigint
      } as unknown as PublicClient;

      const metadata = await getTokenMetadata(
        mockClient,
        '0x514910771AF9Ca656af840dff83E8264EcF986CA' as `0x${string}`
      );

      expect(typeof metadata.decimals).toBe('number');
      expect(metadata.decimals).toBe(18);
    });
  });
});
