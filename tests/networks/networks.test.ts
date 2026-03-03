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
  parseEVMNetwork,
  buildEVMCAIP2,
  validateNetwork,
  isEVMNetwork,
  networksEqual,
  getNetworkReference,
} from '../../src/networks/index.js';

const ETHEREUM: `eip155:${number}` = 'eip155:1';
const BASE: `eip155:${number}` = 'eip155:8453';
const BASE_SEPOLIA: `eip155:${number}` = 'eip155:84532';
const SEPOLIA: `eip155:${number}` = 'eip155:11155111';

describe('getNetworkConfig', () => {
  it('returns a config for Ethereum mainnet', () => {
    const config = getNetworkConfig(ETHEREUM);
    expect(config).toBeDefined();
    expect(config.chainId).toBe(1);
  });

  it('returns a config for Base mainnet', () => {
    const config = getNetworkConfig(BASE);
    expect(config.chainId).toBe(8453);
  });

  it('config includes rpcUrl and chainId', () => {
    const config = getNetworkConfig(BASE);
    expect(typeof config.rpcUrl).toBe('string');
    expect(config.rpcUrl.length).toBeGreaterThan(0);
    expect(config.chainId).toBeGreaterThan(0);
  });
});

describe('getNetworkFromChainId / getChainIdFromNetwork', () => {
  it('converts chainId 1 to eip155:1', () => {
    expect(getNetworkFromChainId(1)).toBe('eip155:1');
  });

  it('converts chainId 8453 to eip155:8453', () => {
    expect(getNetworkFromChainId(8453)).toBe('eip155:8453');
  });

  it('roundtrips: network → chainId → network', () => {
    const chainId = getChainIdFromNetwork(BASE);
    expect(getNetworkFromChainId(chainId)).toBe(BASE);
  });

  it('roundtrips: chainId → network → chainId', () => {
    const network = getNetworkFromChainId(8453);
    expect(getChainIdFromNetwork(network)).toBe(8453);
  });

  it('throws for an unsupported chainId', () => {
    expect(() => getNetworkFromChainId(999999)).toThrow();
  });
});

describe('isTestnet / isMainnet / isLocal', () => {
  it('classifies Ethereum as mainnet', () => {
    expect(isMainnet(ETHEREUM)).toBe(true);
    expect(isTestnet(ETHEREUM)).toBe(false);
    expect(isLocal(ETHEREUM)).toBe(false);
  });

  it('classifies Base as mainnet', () => {
    expect(isMainnet(BASE)).toBe(true);
    expect(isTestnet(BASE)).toBe(false);
  });

  it('classifies Sepolia as testnet', () => {
    expect(isTestnet(SEPOLIA)).toBe(true);
    expect(isMainnet(SEPOLIA)).toBe(false);
  });

  it('classifies Base Sepolia as testnet', () => {
    expect(isTestnet(BASE_SEPOLIA)).toBe(true);
    expect(isMainnet(BASE_SEPOLIA)).toBe(false);
  });
});

describe('getSupportedNetworks', () => {
  it('returns a non-empty array', () => {
    const networks = getSupportedNetworks();
    expect(Array.isArray(networks)).toBe(true);
    expect(networks.length).toBeGreaterThan(0);
  });

  it('includes Ethereum and Base', () => {
    const networks = getSupportedNetworks();
    expect(networks).toContain('eip155:1');
    expect(networks).toContain('eip155:8453');
  });

  it('all entries start with eip155:', () => {
    const networks = getSupportedNetworks();
    for (const n of networks) {
      expect(n.startsWith('eip155:')).toBe(true);
    }
  });
});

describe('getNetworksByType', () => {
  it('returns only mainnets for type mainnet', () => {
    const mainnets = getNetworksByType('mainnet');
    expect(mainnets.length).toBeGreaterThan(0);
    for (const n of mainnets) {
      expect(isMainnet(n)).toBe(true);
    }
  });

  it('returns only testnets for type testnet', () => {
    const testnets = getNetworksByType('testnet');
    expect(testnets.length).toBeGreaterThan(0);
    for (const n of testnets) {
      expect(isTestnet(n)).toBe(true);
    }
  });
});

describe('getTransactionUrl', () => {
  it('returns a valid URL for Base mainnet', () => {
    const url = getTransactionUrl(BASE, '0xabc123');
    expect(url).not.toBeNull();
    expect(url).toContain('0xabc123');
    expect(url).toMatch(/^https?:\/\//);
  });

  it('includes /tx/ in the URL', () => {
    const url = getTransactionUrl(BASE, '0xdeadbeef');
    expect(url).toContain('/tx/0xdeadbeef');
  });
});

describe('getAddressUrl', () => {
  it('returns a valid URL for Ethereum mainnet', () => {
    const addr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const url = getAddressUrl(ETHEREUM, addr);
    expect(url).not.toBeNull();
    expect(url).toContain(addr);
    expect(url).toContain('/address/');
  });
});

describe('parseEVMNetwork', () => {
  it('parses eip155:8453 correctly', () => {
    const result = parseEVMNetwork('eip155:8453');
    expect(result.namespace).toBe('eip155');
    expect(result.chainId).toBe(8453);
  });

  it('parses eip155:1 correctly', () => {
    const result = parseEVMNetwork('eip155:1');
    expect(result.chainId).toBe(1);
  });

  it('throws if identifier does not start with eip155:', () => {
    expect(() => parseEVMNetwork('cosmos:1')).toThrow();
    expect(() => parseEVMNetwork('solana:mainnet')).toThrow();
  });

  it('throws for unsupported chain ID', () => {
    expect(() => parseEVMNetwork('eip155:999999')).toThrow();
  });

  it('throws for non-numeric chain ID', () => {
    expect(() => parseEVMNetwork('eip155:abc')).toThrow();
  });
});

describe('buildEVMCAIP2', () => {
  it('builds eip155:8453 from chainId 8453', () => {
    expect(buildEVMCAIP2(8453)).toBe('eip155:8453');
  });

  it('builds eip155:1 from chainId 1', () => {
    expect(buildEVMCAIP2(1)).toBe('eip155:1');
  });

  it('throws for unsupported chainId', () => {
    expect(() => buildEVMCAIP2(999999)).toThrow();
  });
});

describe('validateNetwork', () => {
  it('returns the network id for valid network', () => {
    expect(validateNetwork('eip155:8453')).toBe('eip155:8453');
  });

  it('throws for unsupported network', () => {
    expect(() => validateNetwork('eip155:999999')).toThrow();
    expect(() => validateNetwork('not-a-network')).toThrow();
  });
});

describe('isEVMNetwork', () => {
  it('returns true for known EVM networks', () => {
    expect(isEVMNetwork('eip155:1')).toBe(true);
    expect(isEVMNetwork('eip155:8453')).toBe(true);
  });

  it('returns false for unknown networks', () => {
    expect(isEVMNetwork('eip155:999999')).toBe(false);
    expect(isEVMNetwork('solana:mainnet')).toBe(false);
    expect(isEVMNetwork('')).toBe(false);
  });
});

describe('networksEqual', () => {
  it('returns true for identical strings', () => {
    expect(networksEqual('eip155:1', 'eip155:1')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(networksEqual('EIP155:1', 'eip155:1')).toBe(true);
  });

  it('returns false for different networks', () => {
    expect(networksEqual('eip155:1', 'eip155:8453')).toBe(false);
  });
});

describe('getNetworkReference', () => {
  it('returns "base" for eip155:8453', () => {
    expect(getNetworkReference(BASE)).toBe('base');
  });

  it('returns "ethereum" for eip155:1', () => {
    expect(getNetworkReference(ETHEREUM)).toBe('ethereum');
  });
});
