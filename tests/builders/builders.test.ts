import { describe, it, expect } from 'vitest';
import {
  buildPaymentRequirements,
  buildUSDCPayment,
  buildLINKPayment,
} from '../../src/builders/index.js';

const PAY_TO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;

describe('buildPaymentRequirements', () => {
  it('builds requirements for USDC on Base', () => {
    const req = buildPaymentRequirements({
      network: 'eip155:8453',
      amount: 1.5,
      asset: 'USDC',
      payTo: PAY_TO,
    });

    expect(req.scheme).toBe('exact');
    expect(req.network).toBe('eip155:8453');
    expect(req.amount).toBe('1500000'); // 1.5 * 10^6
    expect(req.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(req.payTo).toBe(PAY_TO);
    expect(req.maxTimeoutSeconds).toBe(300); // default
  });

  it('populates extra metadata for USDC', () => {
    const req = buildPaymentRequirements({
      network: 'eip155:8453',
      amount: 1,
      asset: 'USDC',
      payTo: PAY_TO,
    });

    expect(req.extra).toBeDefined();
    expect(req.extra!.symbol).toBe('USDC');
    expect(req.extra!.name).toBe('USD Coin');
    expect(req.extra!.decimals).toBe(6);
  });

  it('builds requirements for LINK on Ethereum', () => {
    const req = buildPaymentRequirements({
      network: 'eip155:1',
      amount: 2.5,
      asset: 'LINK',
      payTo: PAY_TO,
    });

    expect(req.amount).toBe('2500000000000000000'); // 2.5 * 10^18
    expect(req.asset).toBe('0x514910771AF9Ca656af840dff83E8264EcF986CA');
    expect(req.extra!.symbol).toBe('LINK');
    expect(req.extra!.decimals).toBe(18);
  });

  it('respects custom maxTimeoutSeconds', () => {
    const req = buildPaymentRequirements({
      network: 'eip155:8453',
      amount: 1,
      asset: 'USDC',
      payTo: PAY_TO,
      maxTimeoutSeconds: 600,
    });

    expect(req.maxTimeoutSeconds).toBe(600);
  });

  it('passes through raw token address without converting amount', () => {
    const customToken = '0x1234567890123456789012345678901234567890' as `0x${string}`;
    const req = buildPaymentRequirements({
      network: 'eip155:1',
      amount: 999999,
      asset: customToken,
      payTo: PAY_TO,
    });

    expect(req.asset).toBe(customToken);
    expect(req.amount).toBe('999999');
  });

  it('throws when token not available on network', () => {
    expect(() =>
      buildPaymentRequirements({
        network: 'eip155:31337', // local network, no USDC address
        amount: 1,
        asset: 'USDC',
        payTo: PAY_TO,
      })
    ).toThrow();
  });

  it('includes creContract in extra when provided', () => {
    const creContract = '0xCaFeBaBeDeAdBeEf000000000000000000000001' as `0x${string}`;
    const req = buildPaymentRequirements({
      network: 'eip155:8453',
      amount: 1,
      asset: 'USDC',
      payTo: PAY_TO,
      creContract,
    });

    expect(req.extra!.creContract).toBe(creContract);
  });
});

describe('buildUSDCPayment', () => {
  it('builds USDC payment requirements for Base', () => {
    const req = buildUSDCPayment({
      network: 'eip155:8453',
      amount: 0.5,
      payTo: PAY_TO,
    });

    expect(req.scheme).toBe('exact');
    expect(req.amount).toBe('500000'); // 0.5 * 10^6
    expect(req.extra!.symbol).toBe('USDC');
  });

  it('respects custom timeout', () => {
    const req = buildUSDCPayment({
      network: 'eip155:8453',
      amount: 1,
      payTo: PAY_TO,
      maxTimeoutSeconds: 120,
    });

    expect(req.maxTimeoutSeconds).toBe(120);
  });

  it('uses default timeout of 300s when not specified', () => {
    const req = buildUSDCPayment({
      network: 'eip155:8453',
      amount: 1,
      payTo: PAY_TO,
    });

    expect(req.maxTimeoutSeconds).toBe(300);
  });

  it('handles fractional USDC amounts correctly', () => {
    const req = buildUSDCPayment({
      network: 'eip155:1',
      amount: 0.01,
      payTo: PAY_TO,
    });

    expect(req.amount).toBe('10000'); // 0.01 * 10^6
  });
});

describe('buildLINKPayment', () => {
  it('builds LINK payment requirements for Ethereum', () => {
    const req = buildLINKPayment({
      network: 'eip155:1',
      amount: 10,
      payTo: PAY_TO,
    });

    expect(req.scheme).toBe('exact');
    expect(req.amount).toBe('10000000000000000000'); // 10 * 10^18
    expect(req.extra!.symbol).toBe('LINK');
    expect(req.extra!.decimals).toBe(18);
  });

  it('builds LINK payment for Sepolia testnet', () => {
    const req = buildLINKPayment({
      network: 'eip155:11155111',
      amount: 1,
      payTo: PAY_TO,
    });

    expect(req.amount).toBe('1000000000000000000'); // 1 * 10^18
    expect(req.network).toBe('eip155:11155111');
  });

  it('respects custom timeout', () => {
    const req = buildLINKPayment({
      network: 'eip155:1',
      amount: 5,
      payTo: PAY_TO,
      maxTimeoutSeconds: 60,
    });

    expect(req.maxTimeoutSeconds).toBe(60);
  });
});
