import { describe, it, expect } from 'vitest';
import {
  encodeBase64,
  decodeBase64,
  normalizeAddress,
  isValidAddress,
  addressesEqual,
  bytesToHex,
  hexToBytesArray,
  padHex,
  numberToHex,
  hexToNumber,
  hexToBigInt,
  encodeCompactSignature,
  decodeCompactSignature,
} from '../../src/utils/encoding.js';

describe('encodeBase64 / decodeBase64', () => {
  it('roundtrips ASCII strings', () => {
    const original = 'hello world';
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });

  it('roundtrips unicode strings', () => {
    const original = '🔗 Chainlink x402 💰';
    expect(decodeBase64(encodeBase64(original))).toBe(original);
  });

  it('encodes empty string', () => {
    expect(encodeBase64('')).toBe('');
    expect(decodeBase64('')).toBe('');
  });

  it('produces base64 output for known input', () => {
    expect(encodeBase64('hello')).toBe('aGVsbG8=');
  });
});

describe('normalizeAddress', () => {
  it('checksums a lowercase address', () => {
    const lower = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const result = normalizeAddress(lower);
    expect(result).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('accepts address without 0x prefix and adds it', () => {
    const result = normalizeAddress('a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
    expect(result.startsWith('0x')).toBe(true);
  });

  it('returns already-checksummed address unchanged', () => {
    const checksummed = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    expect(normalizeAddress(checksummed)).toBe(checksummed);
  });

  it('handles invalid address gracefully (returns lowercase)', () => {
    const result = normalizeAddress('0xnotanaddress');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('isValidAddress', () => {
  it('returns true for a valid checksummed address', () => {
    expect(isValidAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(true);
  });

  it('returns true for a valid lowercase address', () => {
    expect(isValidAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe(true);
  });

  it('returns false for a non-address string', () => {
    expect(isValidAddress('not-an-address')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidAddress('')).toBe(false);
  });

  it('returns false for address that is too short', () => {
    expect(isValidAddress('0x1234')).toBe(false);
  });
});

describe('addressesEqual', () => {
  it('returns true for same-case addresses', () => {
    const addr = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    expect(addressesEqual(addr, addr)).toBe(true);
  });

  it('returns true for mixed-case addresses that are the same address', () => {
    const a = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const b = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    expect(addressesEqual(a, b)).toBe(true);
  });

  it('returns false for different addresses', () => {
    const a = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const b = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
    expect(addressesEqual(a, b)).toBe(false);
  });

  it('returns false when either argument is empty', () => {
    expect(addressesEqual('', '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')).toBe(false);
    expect(addressesEqual('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', '')).toBe(false);
  });
});

describe('bytesToHex / hexToBytesArray', () => {
  it('roundtrips a byte array', () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hex = bytesToHex(original);
    const restored = hexToBytesArray(hex);
    expect(restored).toEqual(original);
  });

  it('bytesToHex starts with 0x', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    expect(bytesToHex(bytes).startsWith('0x')).toBe(true);
  });

  it('handles empty byte array', () => {
    const hex = bytesToHex(new Uint8Array([]));
    expect(hex).toBe('0x');
  });
});

describe('padHex', () => {
  it('pads a short hex to the target byte length', () => {
    expect(padHex('0x1', 4)).toBe('0x00000001');
  });

  it('handles hex without 0x prefix', () => {
    expect(padHex('ff', 2)).toBe('0x00ff');
  });

  it('does not truncate if already long enough', () => {
    expect(padHex('0xdeadbeef', 4)).toBe('0xdeadbeef');
  });
});

describe('numberToHex / hexToNumber', () => {
  it('converts number to hex and back', () => {
    const n = 255;
    expect(hexToNumber(numberToHex(n))).toBe(n);
  });

  it('handles zero', () => {
    expect(numberToHex(0)).toBe('0x0');
    expect(hexToNumber('0x0')).toBe(0);
  });

  it('handles large numbers', () => {
    const n = 8453; // Base chain ID
    const hex = numberToHex(n);
    expect(hexToNumber(hex)).toBe(n);
  });

  it('converts bigint', () => {
    const big = 1000000000000000000n;
    const hex = numberToHex(big);
    expect(hexToBigInt(hex)).toBe(big);
  });
});

describe('hexToBigInt', () => {
  it('converts a hex string to BigInt', () => {
    expect(hexToBigInt('0xff')).toBe(255n);
  });

  it('handles 0x0', () => {
    expect(hexToBigInt('0x0')).toBe(0n);
  });
});

describe('encodeCompactSignature / decodeCompactSignature', () => {
  it('roundtrips a signature', () => {
    const v = 27;
    const r = `0x${'a'.repeat(64)}` as `0x${string}`;
    const s = `0x${'b'.repeat(64)}` as `0x${string}`;

    const compact = encodeCompactSignature(v, r, s);
    const decoded = decodeCompactSignature(compact);

    expect(decoded.v).toBe(v);
    expect(decoded.r).toBe(r);
    expect(decoded.s).toBe(s);
  });

  it('roundtrips with v=28', () => {
    const v = 28;
    const r = `0x${'1'.repeat(64)}` as `0x${string}`;
    const s = `0x${'2'.repeat(64)}` as `0x${string}`;

    const compact = encodeCompactSignature(v, r, s);
    const decoded = decodeCompactSignature(compact);

    expect(decoded.v).toBe(v);
  });

  it('produces a 65-byte (132 hex char + 0x) signature', () => {
    const compact = encodeCompactSignature(
      27,
      `0x${'a'.repeat(64)}` as `0x${string}`,
      `0x${'b'.repeat(64)}` as `0x${string}`
    );
    // 0x + 64 (r) + 64 (s) + 2 (v) = 132 chars after 0x
    expect(compact.slice(2)).toHaveLength(130);
  });
});
