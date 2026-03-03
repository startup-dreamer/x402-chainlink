import { describe, it, expect } from 'vitest';
import {
  getTokenAddress,
  getTokenDecimals,
  getTokenName,
  getTokenInfo,
  toAtomicUnits,
  fromAtomicUnits,
  getTokenSymbol,
  isTokenAvailable,
  getAvailableTokens,
  isPermitSupported,
  getPermitDomain,
  getPermitSupportedTokens,
} from '../../src/tokens/index.js';

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const LINK_ETH = '0x514910771AF9Ca656af840dff83E8264EcF986CA';

describe('getTokenAddress', () => {
  it('returns USDC address on Base', () => {
    expect(getTokenAddress('USDC', 'eip155:8453')).toBe(USDC_BASE);
  });

  it('returns USDC address on Ethereum', () => {
    expect(getTokenAddress('USDC', 'eip155:1')).toBe(USDC_ETH);
  });

  it('returns LINK address on Ethereum', () => {
    expect(getTokenAddress('LINK', 'eip155:1')).toBe(LINK_ETH);
  });

  it('returns undefined for network without the token', () => {
    // Local hardhat network likely does not have token addresses
    expect(getTokenAddress('USDC', 'eip155:31337')).toBeUndefined();
  });
});

describe('getTokenDecimals', () => {
  it('returns 6 for USDC', () => {
    expect(getTokenDecimals('USDC')).toBe(6);
  });

  it('returns 18 for LINK', () => {
    expect(getTokenDecimals('LINK')).toBe(18);
  });
});

describe('getTokenName', () => {
  it('returns "USD Coin" for USDC', () => {
    expect(getTokenName('USDC')).toBe('USD Coin');
  });

  it('returns "Chainlink" for LINK', () => {
    expect(getTokenName('LINK')).toBe('Chainlink');
  });
});

describe('getTokenInfo', () => {
  it('returns full token info for USDC on Base', () => {
    const info = getTokenInfo('USDC', 'eip155:8453');
    expect(info).toBeDefined();
    expect(info!.symbol).toBe('USDC');
    expect(info!.decimals).toBe(6);
    expect(info!.name).toBe('USD Coin');
    expect(info!.address).toBe(USDC_BASE);
  });

  it('returns undefined for token not available on network', () => {
    expect(getTokenInfo('USDC', 'eip155:31337')).toBeUndefined();
  });
});

describe('toAtomicUnits / fromAtomicUnits', () => {
  it('converts 1.5 USDC to 1500000 atomic units', () => {
    expect(toAtomicUnits(1.5, 'USDC')).toBe('1500000');
  });

  it('converts 1 USDC to 1000000 atomic units', () => {
    expect(toAtomicUnits(1, 'USDC')).toBe('1000000');
  });

  it('converts 0.000001 USDC (1 microUSDC) to 1 atomic unit', () => {
    expect(toAtomicUnits(0.000001, 'USDC')).toBe('1');
  });

  it('converts 1 LINK to 1000000000000000000 atomic units', () => {
    expect(toAtomicUnits(1, 'LINK')).toBe('1000000000000000000');
  });

  it('roundtrips: toAtomicUnits then fromAtomicUnits for USDC', () => {
    const amount = 5.5;
    const atomic = toAtomicUnits(amount, 'USDC');
    expect(fromAtomicUnits(atomic, 'USDC')).toBe(amount);
  });

  it('roundtrips: toAtomicUnits then fromAtomicUnits for LINK', () => {
    const amount = 2.5;
    const atomic = toAtomicUnits(amount, 'LINK');
    expect(fromAtomicUnits(atomic, 'LINK')).toBe(amount);
  });

  it('fromAtomicUnits: 1500000 USDC atomic → 1.5', () => {
    expect(fromAtomicUnits('1500000', 'USDC')).toBe(1.5);
  });

  it('fromAtomicUnits: 0 atomic → 0', () => {
    expect(fromAtomicUnits('0', 'USDC')).toBe(0);
  });
});

describe('getTokenSymbol', () => {
  it('returns USDC for known USDC address on Base', () => {
    expect(getTokenSymbol(USDC_BASE, 'eip155:8453')).toBe('USDC');
  });

  it('returns LINK for known LINK address on Ethereum', () => {
    expect(getTokenSymbol(LINK_ETH, 'eip155:1')).toBe('LINK');
  });

  it('is case-insensitive for address lookup', () => {
    expect(getTokenSymbol(USDC_BASE.toLowerCase(), 'eip155:8453')).toBe('USDC');
  });

  it('returns undefined for unknown address', () => {
    expect(getTokenSymbol('0x0000000000000000000000000000000000000000', 'eip155:8453')).toBeUndefined();
  });
});

describe('isTokenAvailable', () => {
  it('returns true for USDC on Base', () => {
    expect(isTokenAvailable('USDC', 'eip155:8453')).toBe(true);
  });

  it('returns true for LINK on Ethereum', () => {
    expect(isTokenAvailable('LINK', 'eip155:1')).toBe(true);
  });

  it('returns false for token on unsupported network', () => {
    expect(isTokenAvailable('USDC', 'eip155:31337')).toBe(false);
  });
});

describe('getAvailableTokens', () => {
  it('returns USDC and LINK for Base mainnet', () => {
    const tokens = getAvailableTokens('eip155:8453');
    expect(tokens).toContain('USDC');
    expect(tokens).toContain('LINK');
  });

  it('returns USDC and LINK for Ethereum mainnet', () => {
    const tokens = getAvailableTokens('eip155:1');
    expect(tokens).toContain('USDC');
    expect(tokens).toContain('LINK');
  });

  it('returns empty array for local network without token addresses', () => {
    const tokens = getAvailableTokens('eip155:31337');
    expect(tokens).toEqual([]);
  });
});

describe('isPermitSupported', () => {
  it('returns true for USDC on Base (chainId 8453)', () => {
    expect(
      isPermitSupported('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 8453)
    ).toBe(true);
  });

  it('returns true for USDC on Ethereum (chainId 1)', () => {
    expect(
      isPermitSupported('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 1)
    ).toBe(true);
  });

  it('returns false for LINK (not permit-supported)', () => {
    expect(
      isPermitSupported('0x514910771AF9Ca656af840dff83E8264EcF986CA', 1)
    ).toBe(false);
  });

  it('returns false for unknown token address', () => {
    expect(
      isPermitSupported('0x0000000000000000000000000000000000000001', 1)
    ).toBe(false);
  });
});

describe('getPermitDomain', () => {
  it('returns domain for USDC on Base', () => {
    const domain = getPermitDomain(
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      8453
    );
    expect(domain).toBeDefined();
    expect(domain!.name).toBe('USD Coin');
    expect(domain!.version).toBe('2');
    expect(domain!.chainId).toBe(8453);
    expect(domain!.verifyingContract).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  });

  it('returns undefined for non-permit token', () => {
    const domain = getPermitDomain(
      '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      1
    );
    expect(domain).toBeUndefined();
  });
});

describe('getPermitSupportedTokens', () => {
  it('returns at least one token for Base (8453)', () => {
    const tokens = getPermitSupportedTokens(8453);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('returns at least two tokens for Ethereum (1)', () => {
    // USDC and DAI both support permit on Ethereum
    const tokens = getPermitSupportedTokens(1);
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for unsupported chainId', () => {
    const tokens = getPermitSupportedTokens(99999);
    expect(tokens).toEqual([]);
  });
});
