import { describe, it, expect } from 'vitest';
import {
  encodePaymentSignature,
  decodePaymentSignature,
  encodePaymentRequired,
  decodePaymentRequired,
  encodePaymentResponse,
  decodePaymentResponse,
  checkPermitSupport,
  HTTP_HEADERS,
} from '../../src/payment/create.js';
import type { PaymentPayload } from '../../src/types/payment.js';
import type { SettleResponse } from '../../src/types/settlement.js';

const MOCK_PAY_TO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as `0x${string}`;
const MOCK_PAYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`;
const MOCK_TOKEN = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`;

const mockPaymentPayload: PaymentPayload = {
  x402Version: 2,
  accepted: {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: MOCK_TOKEN,
    payTo: MOCK_PAY_TO,
    maxTimeoutSeconds: 300,
  },
  payload: {
    signature: `0x${'a'.repeat(130)}` as `0x${string}`,
    authorization: {
      from: MOCK_PAYER,
      to: MOCK_PAY_TO,
      amount: '1000000',
      token: MOCK_TOKEN,
      nonce: '1',
      validUntil: String(Math.floor(Date.now() / 1000) + 300),
      chainId: 8453,
    },
  },
  creEndpoint: 'https://cre.example.com',
};

describe('encodePaymentSignature / decodePaymentSignature', () => {
  it('roundtrips a payment payload', () => {
    const encoded = encodePaymentSignature(mockPaymentPayload);
    const decoded = decodePaymentSignature(encoded);

    expect(decoded.x402Version).toBe(2);
    expect(decoded.accepted.network).toBe('eip155:8453');
    expect(decoded.accepted.amount).toBe('1000000');
    expect(decoded.payload.authorization.from).toBe(MOCK_PAYER);
  });

  it('encodes to a non-empty base64 string', () => {
    const encoded = encodePaymentSignature(mockPaymentPayload);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('encoded string is valid base64', () => {
    const encoded = encodePaymentSignature(mockPaymentPayload);
    // Base64 chars only: A-Z, a-z, 0-9, +, /, =
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('decodePaymentSignature throws on non-object base64', () => {
    // Encode an array, which is not an object
    const arrayEncoded = Buffer.from(JSON.stringify([1, 2, 3])).toString('base64');
    expect(() => decodePaymentSignature(arrayEncoded)).toThrow();
  });

  it('decodePaymentSignature throws on null base64', () => {
    const nullEncoded = Buffer.from(JSON.stringify(null)).toString('base64');
    expect(() => decodePaymentSignature(nullEncoded)).toThrow();
  });

  it('decodePaymentSignature throws on invalid base64', () => {
    expect(() => decodePaymentSignature('!!!not-base64!!!')).toThrow();
  });

  it('preserves creEndpoint through roundtrip', () => {
    const encoded = encodePaymentSignature(mockPaymentPayload);
    const decoded = decodePaymentSignature(encoded);
    expect(decoded.creEndpoint).toBe('https://cre.example.com');
  });
});

describe('encodePaymentRequired / decodePaymentRequired', () => {
  const mockPaymentRequired = {
    x402Version: 2 as const,
    resource: { url: 'https://api.example.com/data' },
    accepts: [
      {
        scheme: 'exact' as const,
        network: 'eip155:8453' as const,
        amount: '1000000',
        asset: MOCK_TOKEN,
        payTo: MOCK_PAY_TO,
        maxTimeoutSeconds: 300,
      },
    ],
  };

  it('roundtrips a payment required response', () => {
    const encoded = encodePaymentRequired(mockPaymentRequired);
    const decoded = decodePaymentRequired(encoded);

    expect(decoded.x402Version).toBe(2);
    expect(decoded.resource.url).toBe('https://api.example.com/data');
    expect(decoded.accepts).toHaveLength(1);
    expect(decoded.accepts[0].amount).toBe('1000000');
  });

  it('encodes to a non-empty base64 string', () => {
    const encoded = encodePaymentRequired(mockPaymentRequired);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('decodePaymentRequired throws on non-object input', () => {
    const arrayEncoded = Buffer.from(JSON.stringify(['not', 'an', 'object'])).toString('base64');
    expect(() => decodePaymentRequired(arrayEncoded)).toThrow();
  });
});

describe('encodePaymentResponse / decodePaymentResponse', () => {
  const mockSettleResponse: SettleResponse = {
    success: true,
    transaction: '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef' as `0x${string}`,
    network: 'eip155:8453',
    payer: MOCK_PAYER,
    status: 'confirmed',
    blockNumber: 12345678,
  };

  it('roundtrips a settlement response', () => {
    const encoded = encodePaymentResponse(mockSettleResponse);
    const decoded = decodePaymentResponse(encoded);

    expect(decoded.success).toBe(true);
    expect(decoded.network).toBe('eip155:8453');
    expect(decoded.status).toBe('confirmed');
    expect(decoded.blockNumber).toBe(12345678);
  });

  it('roundtrips a failed settlement response', () => {
    const failedResponse: SettleResponse = {
      success: false,
      errorReason: 'insufficient_funds',
      transaction: '',
      network: 'eip155:8453',
    };
    const encoded = encodePaymentResponse(failedResponse);
    const decoded = decodePaymentResponse(encoded);

    expect(decoded.success).toBe(false);
    expect(decoded.errorReason).toBe('insufficient_funds');
    expect(decoded.transaction).toBe('');
  });

  it('decodePaymentResponse throws on non-object input', () => {
    const arrayEncoded = Buffer.from(JSON.stringify([1])).toString('base64');
    expect(() => decodePaymentResponse(arrayEncoded)).toThrow();
  });
});

describe('checkPermitSupport', () => {
  it('returns true for USDC on Base (chainId 8453)', () => {
    expect(
      checkPermitSupport('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 8453)
    ).toBe(true);
  });

  it('returns true for USDC on Ethereum (chainId 1)', () => {
    expect(
      checkPermitSupport('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 1)
    ).toBe(true);
  });

  it('returns false for unknown token on Base', () => {
    expect(
      checkPermitSupport('0x0000000000000000000000000000000000000001', 8453)
    ).toBe(false);
  });

  it('returns false for LINK (no permit support)', () => {
    expect(
      checkPermitSupport('0x514910771AF9Ca656af840dff83E8264EcF986CA', 1)
    ).toBe(false);
  });
});

describe('HTTP_HEADERS', () => {
  it('has PAYMENT_REQUIRED header name', () => {
    expect(HTTP_HEADERS.PAYMENT_REQUIRED).toBeDefined();
    expect(typeof HTTP_HEADERS.PAYMENT_REQUIRED).toBe('string');
  });

  it('has PAYMENT_SIGNATURE header name', () => {
    expect(HTTP_HEADERS.PAYMENT_SIGNATURE).toBeDefined();
    expect(typeof HTTP_HEADERS.PAYMENT_SIGNATURE).toBe('string');
  });

  it('has PAYMENT_RESPONSE header name', () => {
    expect(HTTP_HEADERS.PAYMENT_RESPONSE).toBeDefined();
    expect(typeof HTTP_HEADERS.PAYMENT_RESPONSE).toBe('string');
  });

  it('all header names are uppercase strings', () => {
    for (const value of Object.values(HTTP_HEADERS)) {
      expect(value).toBe(value.toUpperCase());
    }
  });
});
