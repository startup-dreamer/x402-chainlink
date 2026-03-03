/**
 * Token utilities tests for EVM chains
 */

import { describe, it, expect } from 'vitest';
import {
  getTokenAddress,
  getTokenDecimals,
  getTokenName,
  getTokenInfo,
  getTokenSymbol,
  toAtomicUnits,
  fromAtomicUnits,
  isTokenAvailable,
  isNativeToken,
  getAvailableTokens,
  USDC_ADDRESSES,
  LINK_ADDRESSES,
  TOKEN_DECIMALS,
} from '../../src/tokens/index.js';
import type { EVMNetworkId } from '../../src/types/index.js';

describe('Token Utilities (EVM)', () => {
  describe('Token Addresses', () => {
    it('should have USDC addresses for major networks', () => {
      expect(USDC_ADDRESSES['eip155:1']).toBeDefined();
      expect(USDC_ADDRESSES['eip155:8453']).toBeDefined();
      expect(USDC_ADDRESSES['eip155:137']).toBeDefined();
      expect(USDC_ADDRESSES['eip155:42161']).toBeDefined();
    });

    it('should have LINK addresses for major networks', () => {
      expect(LINK_ADDRESSES['eip155:1']).toBeDefined();
      expect(LINK_ADDRESSES['eip155:8453']).toBeDefined();
      expect(LINK_ADDRESSES['eip155:137']).toBeDefined();
    });
  });

  describe('getTokenAddress', () => {
    it('should return null for ETH (native)', () => {
      const address = getTokenAddress('ETH', 'eip155:1');
      expect(address).toBeNull();
    });

    it('should return address for USDC', () => {
      const address = getTokenAddress('USDC', 'eip155:1');
      expect(address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    });

    it('should return address for LINK', () => {
      const address = getTokenAddress('LINK', 'eip155:1');
      expect(address).toBe('0x514910771AF9Ca656af840dff83E8264EcF986CA');
    });

    it('should return undefined for unsupported network/token', () => {
      const address = getTokenAddress('USDC', 'eip155:31337');
      expect(address).toBeUndefined();
    });
  });

  describe('getTokenDecimals', () => {
    it('should return 18 for ETH', () => {
      expect(getTokenDecimals('ETH')).toBe(18);
    });

    it('should return 6 for USDC', () => {
      expect(getTokenDecimals('USDC')).toBe(6);
    });

    it('should return 18 for LINK', () => {
      expect(getTokenDecimals('LINK')).toBe(18);
    });
  });

  describe('getTokenName', () => {
    it('should return correct names', () => {
      expect(getTokenName('ETH')).toBe('Ether');
      expect(getTokenName('USDC')).toBe('USD Coin');
      expect(getTokenName('LINK')).toBe('Chainlink');
    });
  });

  describe('isNativeToken', () => {
    it('should return true for ETH', () => {
      expect(isNativeToken('ETH')).toBe(true);
    });

    it('should return false for ERC-20 tokens', () => {
      expect(isNativeToken('USDC')).toBe(false);
      expect(isNativeToken('LINK')).toBe(false);
    });
  });

  describe('toAtomicUnits', () => {
    it('should convert ETH correctly', () => {
      const atomic = toAtomicUnits(1, 'ETH');
      expect(atomic).toBe('1000000000000000000');
    });

    it('should convert USDC correctly', () => {
      const atomic = toAtomicUnits(1.5, 'USDC');
      expect(atomic).toBe('1500000');
    });

    it('should handle small amounts', () => {
      const atomic = toAtomicUnits(0.000001, 'ETH');
      expect(atomic).toBe('1000000000000');
    });
  });

  describe('fromAtomicUnits', () => {
    it('should convert ETH correctly', () => {
      const amount = fromAtomicUnits('1000000000000000000', 'ETH');
      expect(amount).toBe(1);
    });

    it('should convert USDC correctly', () => {
      const amount = fromAtomicUnits('1500000', 'USDC');
      expect(amount).toBe(1.5);
    });
  });

  describe('isTokenAvailable', () => {
    it('should return true for ETH on any network', () => {
      expect(isTokenAvailable('ETH', 'eip155:1')).toBe(true);
      expect(isTokenAvailable('ETH', 'eip155:8453')).toBe(true);
      expect(isTokenAvailable('ETH', 'eip155:31337')).toBe(true);
    });

    it('should return true for USDC on mainnet', () => {
      expect(isTokenAvailable('USDC', 'eip155:1')).toBe(true);
    });

    it('should return false for USDC on local', () => {
      expect(isTokenAvailable('USDC', 'eip155:31337')).toBe(false);
    });
  });

  describe('getAvailableTokens', () => {
    it('should include ETH for all networks', () => {
      const tokens = getAvailableTokens('eip155:31337');
      expect(tokens).toContain('ETH');
    });

    it('should include all tokens for mainnet', () => {
      const tokens = getAvailableTokens('eip155:1');
      expect(tokens).toContain('ETH');
      expect(tokens).toContain('USDC');
      expect(tokens).toContain('LINK');
    });
  });

  describe('getTokenSymbol', () => {
    it('should identify ETH from null address', () => {
      const symbol = getTokenSymbol(null, 'eip155:1');
      expect(symbol).toBe('ETH');
    });

    it('should identify USDC from address', () => {
      const symbol = getTokenSymbol(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        'eip155:1'
      );
      expect(symbol).toBe('USDC');
    });

    it('should return undefined for unknown address', () => {
      const symbol = getTokenSymbol(
        '0x1234567890123456789012345678901234567890',
        'eip155:1'
      );
      expect(symbol).toBeUndefined();
    });
  });

  describe('getTokenInfo', () => {
    it('should return complete token info for ETH', () => {
      const info = getTokenInfo('ETH', 'eip155:1');
      expect(info).toEqual({
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        address: null,
      });
    });

    it('should return complete token info for USDC', () => {
      const info = getTokenInfo('USDC', 'eip155:8453');
      expect(info?.symbol).toBe('USDC');
      expect(info?.name).toBe('USD Coin');
      expect(info?.decimals).toBe(6);
      expect(info?.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    });

    it('should return undefined for unavailable token', () => {
      const info = getTokenInfo('USDC', 'eip155:31337');
      expect(info).toBeUndefined();
    });
  });
});
