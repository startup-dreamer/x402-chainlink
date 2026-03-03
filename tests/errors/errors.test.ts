import { describe, it, expect } from 'vitest';
import {
  X402Error,
  PaymentError,
  NetworkError,
  err,
  wrapUnknown,
  safe,
  toDTO,
  isX402Error,
  ERROR_CODES,
} from '../../src/errors.js';

describe('X402Error', () => {
  it('constructs with code and message', () => {
    const e = new X402Error('EINVALID_INPUT', 'bad input');
    expect(e.code).toBe('EINVALID_INPUT');
    expect(e.message).toBe('bad input');
    expect(e.name).toBe('X402Error');
    expect(e instanceof Error).toBe(true);
  });

  it('stores cause when provided', () => {
    const cause = new Error('root cause');
    const e = new X402Error('EINTERNAL', 'wrapped', { cause });
    expect(e.cause).toBe(cause);
  });

  it('stores details when provided', () => {
    const details = { field: 'amount', value: -1 };
    const e = new X402Error('EINVALID_INPUT', 'negative amount', { details });
    expect(e.details).toEqual(details);
  });

  it('has undefined cause/details when not provided', () => {
    const e = new X402Error('ECANCELLED', 'cancelled');
    expect(e.cause).toBeUndefined();
    expect(e.details).toBeUndefined();
  });
});

describe('err factory functions', () => {
  it('err.invalid creates EINVALID_INPUT error', () => {
    const e = err.invalid('bad value');
    expect(e.code).toBe('EINVALID_INPUT');
    expect(e.message).toBe('bad value');
  });

  it('err.invalid stores details', () => {
    const e = err.invalid('bad value', { field: 'x' });
    expect(e.details).toEqual({ field: 'x' });
  });

  it('err.notFound creates ENOT_FOUND error with "not found" suffix', () => {
    const e = err.notFound('user');
    expect(e.code).toBe('ENOT_FOUND');
    expect(e.message).toContain('not found');
    expect(e.message).toContain('user');
  });

  it('err.timeout creates ETIMEOUT error with ms in message', () => {
    const e = err.timeout(5000);
    expect(e.code).toBe('ETIMEOUT');
    expect(e.message).toContain('5000');
    expect(e.details).toEqual({ ms: 5000 });
  });

  it('err.conflict creates ECONFLICT error', () => {
    const e = err.conflict('state mismatch');
    expect(e.code).toBe('ECONFLICT');
    expect(e.message).toBe('state mismatch');
  });

  it('err.cancelled creates ECANCELLED error', () => {
    const e = err.cancelled();
    expect(e.code).toBe('ECANCELLED');
    expect(e.message).toContain('cancelled');
  });

  it('err.internal creates EINTERNAL error', () => {
    const e = err.internal('unexpected failure');
    expect(e.code).toBe('EINTERNAL');
    expect(e.message).toBe('unexpected failure');
  });

  it('err.internal stores cause', () => {
    const cause = new Error('db error');
    const e = err.internal('db failed', cause);
    expect(e.cause).toBe(cause);
  });

  it('err.network creates ENETWORK error', () => {
    const e = err.network('RPC timeout');
    expect(e.code).toBe('ENETWORK');
    expect(e.message).toBe('RPC timeout');
  });

  it('err.paymaster creates EPAYMASTER error', () => {
    const e = err.paymaster('paymaster unavailable');
    expect(e.code).toBe('EPAYMASTER');
    expect(e.message).toBe('paymaster unavailable');
  });
});

describe('wrapUnknown', () => {
  it('passes through X402Error unchanged', () => {
    const original = err.invalid('already x402');
    const wrapped = wrapUnknown(original);
    expect(wrapped).toBe(original);
  });

  it('wraps a plain Error into X402Error', () => {
    const original = new Error('plain error');
    const wrapped = wrapUnknown(original);
    expect(wrapped instanceof X402Error).toBe(true);
    expect(wrapped.cause).toBe(original);
  });

  it('wraps a string into X402Error', () => {
    const wrapped = wrapUnknown('something went wrong');
    expect(wrapped instanceof X402Error).toBe(true);
    expect(wrapped.code).toBe('EINTERNAL');
  });

  it('uses provided code and note', () => {
    const wrapped = wrapUnknown(new Error('rpc'), 'ENETWORK', 'RPC failed');
    expect(wrapped.code).toBe('ENETWORK');
    expect(wrapped.message).toBe('RPC failed');
  });
});

describe('safe()', () => {
  it('returns {ok:true, value} for resolved promise', async () => {
    const result = await safe(Promise.resolve(42));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it('returns {ok:false, error} for rejected promise', async () => {
    const result = await safe(Promise.reject(new Error('oops')));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error instanceof X402Error).toBe(true);
    }
  });

  it('wraps thrown X402Error directly', async () => {
    const original = err.invalid('bad');
    const result = await safe(Promise.reject(original));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(original);
    }
  });
});

describe('toDTO', () => {
  it('converts X402Error to DTO shape', () => {
    const e = err.invalid('bad input', { field: 'amount' });
    const dto = toDTO(e);
    expect(dto.name).toBe('X402Error');
    expect(dto.code).toBe('EINVALID_INPUT');
    expect(dto.message).toBe('bad input');
    expect(dto.details).toEqual({ field: 'amount' });
  });

  it('does not include cause in DTO', () => {
    const e = err.internal('internal', new Error('secret cause'));
    const dto = toDTO(e);
    expect('cause' in dto).toBe(false);
  });

  it('converts unknown error to DTO', () => {
    const dto = toDTO(new Error('plain error'));
    expect(dto.code).toBe('EINTERNAL');
  });

  it('converts string to DTO', () => {
    const dto = toDTO('something broke');
    expect(dto.code).toBe('EINTERNAL');
  });
});

describe('isX402Error', () => {
  it('returns true for X402Error instance', () => {
    expect(isX402Error(err.invalid('test'))).toBe(true);
  });

  it('returns true for PaymentError instance', () => {
    expect(isX402Error(PaymentError.invalidPayload())).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isX402Error(new Error('plain'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isX402Error(null)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isX402Error('error string')).toBe(false);
  });
});

describe('PaymentError static factories', () => {
  it('invalidPayload creates EINVALID_INPUT error', () => {
    const e = PaymentError.invalidPayload();
    expect(e.code).toBe('EINVALID_INPUT');
    expect(e.message).toContain('Invalid payment payload');
  });

  it('invalidPayload includes details string', () => {
    const e = PaymentError.invalidPayload('missing signature');
    expect(e.message).toContain('missing signature');
  });

  it('insufficientFunds creates ECONFLICT with amounts in message', () => {
    const e = PaymentError.insufficientFunds('1000000', '500000');
    expect(e.code).toBe('ECONFLICT');
    expect(e.message).toContain('1000000');
    expect(e.message).toContain('500000');
    expect(e.details).toEqual({ required: '1000000', available: '500000' });
  });

  it('verificationFailed creates EINVALID_INPUT with reason', () => {
    const e = PaymentError.verificationFailed('signature mismatch');
    expect(e.code).toBe('EINVALID_INPUT');
    expect(e.message).toContain('signature mismatch');
  });

  it('settlementFailed creates EINTERNAL with reason', () => {
    const e = PaymentError.settlementFailed('tx reverted');
    expect(e.code).toBe('EINTERNAL');
    expect(e.message).toContain('tx reverted');
  });
});

describe('NetworkError static factories', () => {
  it('unsupportedNetwork creates EINVALID_INPUT with network in message', () => {
    const e = NetworkError.unsupportedNetwork('eip155:99999');
    expect(e.code).toBe('EINVALID_INPUT');
    expect(e.message).toContain('eip155:99999');
  });

  it('networkMismatch creates ECONFLICT with expected and actual', () => {
    const e = NetworkError.networkMismatch('eip155:1', 'eip155:8453');
    expect(e.code).toBe('ECONFLICT');
    expect(e.message).toContain('eip155:1');
    expect(e.message).toContain('eip155:8453');
  });

  it('rpcFailed creates ENETWORK error', () => {
    const e = NetworkError.rpcFailed('connection refused');
    expect(e.code).toBe('ENETWORK');
    expect(e.message).toContain('connection refused');
  });
});

describe('ERROR_CODES constants', () => {
  it('exports all expected error codes', () => {
    expect(ERROR_CODES.EINVALID_INPUT).toBe('EINVALID_INPUT');
    expect(ERROR_CODES.ENOT_FOUND).toBe('ENOT_FOUND');
    expect(ERROR_CODES.ETIMEOUT).toBe('ETIMEOUT');
    expect(ERROR_CODES.ECONFLICT).toBe('ECONFLICT');
    expect(ERROR_CODES.ECANCELLED).toBe('ECANCELLED');
    expect(ERROR_CODES.EINTERNAL).toBe('EINTERNAL');
    expect(ERROR_CODES.ENETWORK).toBe('ENETWORK');
    expect(ERROR_CODES.EPAYMASTER).toBe('EPAYMASTER');
  });
});
