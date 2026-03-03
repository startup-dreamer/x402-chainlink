/**
 * Network utilities tests for EVM chains
 */

import { describe, it, expect } from 'vitest';
import {
  getNetworkConfig,
  getNetworkFromChainId,
  getChainIdFromNetwork,
  isTestnet,
  isMainnet,
  isLocal,
  getSupportedNetworks,
  getNetworksByType,
  getTransactionUrl,
  getAddressUrl,
  isEVMNetwork,
  parseEVMNetwork,
  buildEVMCAIP2,
  validateNetwork,
  networksEqual,
  EVM_NETWORKS,
  CHAIN_IDS,
} from '../../src/networks/index.js';

describe('Network Utilities (EVM)', () => {
  describe('Constants', () => {
    it('should have correct chain IDs', () => {
      expect(CHAIN_IDS.ETHEREUM).toBe(1);
      expect(CHAIN_IDS.BASE).toBe(8453);
      expect(CHAIN_IDS.POLYGON).toBe(137);
      expect(CHAIN_IDS.ARBITRUM).toBe(42161);
    });

    it('should have all supported networks', () => {
      expect(EVM_NETWORKS).toContain('eip155:1');
      expect(EVM_NETWORKS).toContain('eip155:8453');
      expect(EVM_NETWORKS).toContain('eip155:137');
      expect(EVM_NETWORKS).toContain('eip155:42161');
      expect(EVM_NETWORKS).toContain('eip155:11155111');
      expect(EVM_NETWORKS).toContain('eip155:84532');
    });
  });

  describe('getNetworkConfig', () => {
    it('should return config for Ethereum mainnet', () => {
      const config = getNetworkConfig('eip155:1');
      expect(config.chainId).toBe(1);
      expect(config.name).toBe('Ethereum Mainnet');
      expect(config.type).toBe('mainnet');
    });

    it('should return config for Base', () => {
      const config = getNetworkConfig('eip155:8453');
      expect(config.chainId).toBe(8453);
      expect(config.name).toBe('Base');
      expect(config.type).toBe('mainnet');
    });

    it('should return config for testnets', () => {
      const config = getNetworkConfig('eip155:84532');
      expect(config.name).toBe('Base Sepolia');
      expect(config.type).toBe('testnet');
    });
  });

  describe('getNetworkFromChainId', () => {
    it('should return correct network for chain ID', () => {
      expect(getNetworkFromChainId(1)).toBe('eip155:1');
      expect(getNetworkFromChainId(8453)).toBe('eip155:8453');
      expect(getNetworkFromChainId(137)).toBe('eip155:137');
    });

    it('should throw for unknown chain ID', () => {
      expect(() => getNetworkFromChainId(999999)).toThrow();
    });
  });

  describe('getChainIdFromNetwork', () => {
    it('should return correct chain ID', () => {
      expect(getChainIdFromNetwork('eip155:1')).toBe(1);
      expect(getChainIdFromNetwork('eip155:8453')).toBe(8453);
    });
  });

  describe('isTestnet / isMainnet / isLocal', () => {
    it('should correctly identify mainnets', () => {
      expect(isMainnet('eip155:1')).toBe(true);
      expect(isMainnet('eip155:8453')).toBe(true);
      expect(isMainnet('eip155:84532')).toBe(false);
    });

    it('should correctly identify testnets', () => {
      expect(isTestnet('eip155:11155111')).toBe(true);
      expect(isTestnet('eip155:84532')).toBe(true);
      expect(isTestnet('eip155:1')).toBe(false);
    });

    it('should correctly identify local networks', () => {
      expect(isLocal('eip155:31337')).toBe(true);
      expect(isLocal('eip155:1')).toBe(false);
    });
  });

  describe('getSupportedNetworks', () => {
    it('should return all supported networks', () => {
      const networks = getSupportedNetworks();
      expect(networks.length).toBeGreaterThan(0);
      expect(networks).toContain('eip155:1');
      expect(networks).toContain('eip155:8453');
    });
  });

  describe('getNetworksByType', () => {
    it('should return mainnets', () => {
      const mainnets = getNetworksByType('mainnet');
      expect(mainnets).toContain('eip155:1');
      expect(mainnets).toContain('eip155:8453');
      expect(mainnets).not.toContain('eip155:84532');
    });

    it('should return testnets', () => {
      const testnets = getNetworksByType('testnet');
      expect(testnets).toContain('eip155:11155111');
      expect(testnets).toContain('eip155:84532');
    });
  });

  describe('Explorer URLs', () => {
    it('should generate transaction URL', () => {
      const url = getTransactionUrl('eip155:8453', '0x1234');
      expect(url).toBe('https://basescan.org/tx/0x1234');
    });

    it('should generate address URL', () => {
      const url = getAddressUrl('eip155:1', '0xabcd');
      expect(url).toBe('https://etherscan.io/address/0xabcd');
    });

    it('should return null for local network', () => {
      const url = getTransactionUrl('eip155:31337', '0x1234');
      expect(url).toBeNull();
    });
  });

  describe('isEVMNetwork', () => {
    it('should return true for valid networks', () => {
      expect(isEVMNetwork('eip155:1')).toBe(true);
      expect(isEVMNetwork('eip155:8453')).toBe(true);
    });

    it('should return false for invalid networks', () => {
      expect(isEVMNetwork('starknet:mainnet')).toBe(false);
      expect(isEVMNetwork('invalid')).toBe(false);
    });
  });

  describe('parseEVMNetwork', () => {
    it('should parse valid network', () => {
      const result = parseEVMNetwork('eip155:8453');
      expect(result.namespace).toBe('eip155');
      expect(result.chainId).toBe(8453);
      expect(result.reference).toBe('base');
    });

    it('should throw for invalid format', () => {
      expect(() => parseEVMNetwork('invalid')).toThrow();
    });
  });

  describe('buildEVMCAIP2', () => {
    it('should build CAIP-2 from chain ID', () => {
      expect(buildEVMCAIP2(1)).toBe('eip155:1');
      expect(buildEVMCAIP2(8453)).toBe('eip155:8453');
    });

    it('should throw for unsupported chain ID', () => {
      expect(() => buildEVMCAIP2(999999)).toThrow();
    });
  });

  describe('validateNetwork', () => {
    it('should return validated network', () => {
      expect(validateNetwork('eip155:1')).toBe('eip155:1');
    });

    it('should throw for invalid network', () => {
      expect(() => validateNetwork('invalid')).toThrow();
    });
  });

  describe('networksEqual', () => {
    it('should return true for equal networks', () => {
      expect(networksEqual('eip155:1', 'eip155:1')).toBe(true);
    });

    it('should return false for different networks', () => {
      expect(networksEqual('eip155:1', 'eip155:8453')).toBe(false);
    });
  });
});
