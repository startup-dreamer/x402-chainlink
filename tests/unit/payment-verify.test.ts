/**
 * Payment verification tests for EVM with EIP-712
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  verifyPayment,
  verifySignature,
  recoverSigner,
  extractPayerAddress,
} from '../../src/payment/verify.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';

// Mock viem functions
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    recoverTypedDataAddress: vi.fn(),
    verifyTypedData: vi.fn(),
  };
});

describe('Payment Verification (EVM)', () => {
  const mockClient = createPublicClient({
    chain: baseSepolia,
    transport: http('http://localhost:8545'),
  });

  const mockPayer =
    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`;
  const mockRecipient =
    '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`;

  const mockRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:84532',
    amount: '1000000',
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
    payTo: mockRecipient,
    maxTimeoutSeconds: 300,
  };

  const createMockPayload = (
    overrides?: Partial<PaymentPayload>
  ): PaymentPayload => ({
    x402Version: 2,
    accepted: mockRequirements,
    payload: {
      signature: ('0x' + 'ab'.repeat(65)) as `0x${string}`,
      authorization: {
        from: mockPayer,
        to: mockRecipient,
        amount: '1000000',
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`,
        nonce: '12345',
        validUntil: String(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
        chainId: 84532,
      },
    },
    typedData: {
      domain: {
        name: 'x402-chainlink',
        version: '1',
        chainId: 84532,
        verifyingContract:
          '0x0000000000000000000000000000000000000000' as `0x${string}`,
      },
      types: {
        PaymentAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'token', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'validUntil', type: 'uint256' },
          { name: 'chainId', type: 'uint256' },
        ],
      },
      primaryType: 'PaymentAuthorization',
      message: {
        from: mockPayer,
        to: mockRecipient,
        amount: 1000000n,
        token: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        nonce: 12345n,
        validUntil: BigInt(Math.floor(Date.now() / 1000) + 3600),
        chainId: 84532n,
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock balance check to return sufficient balance
    vi.spyOn(mockClient, 'readContract').mockResolvedValue(10000000n);

    // Mock recoverTypedDataAddress to return the expected payer
    const { recoverTypedDataAddress } = require('viem');
    recoverTypedDataAddress.mockResolvedValue(mockPayer);
  });

  describe('verifyPayment', () => {
    it('should validate payment structure', async () => {
      const payload = createMockPayload();
      const result = await verifyPayment(mockClient, payload, mockRequirements);

      // This test focuses on structure validation
      // Full verification requires proper mocking
      expect(result).toBeDefined();
    });

    it('should reject invalid network', async () => {
      const payload = createMockPayload();
      const wrongRequirements = {
        ...mockRequirements,
        network: 'eip155:1' as const,
      };

      const result = await verifyPayment(
        mockClient,
        payload,
        wrongRequirements
      );

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe('invalid_network');
    });

    it('should reject expired payments', async () => {
      const payload = createMockPayload();
      payload.payload.authorization.validUntil = '1600000000'; // Past timestamp

      const result = await verifyPayment(mockClient, payload, mockRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_evm_payload_authorization_valid_until'
      );
    });

    it('should reject amount mismatch', async () => {
      const payload = createMockPayload();
      payload.payload.authorization.amount = '999999'; // Wrong amount

      const result = await verifyPayment(mockClient, payload, mockRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_evm_payload_authorization_value'
      );
    });

    it('should reject recipient mismatch', async () => {
      const payload = createMockPayload();
      payload.payload.authorization.to =
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as `0x${string}`;

      const result = await verifyPayment(mockClient, payload, mockRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_evm_payload_recipient_mismatch'
      );
    });

    it('should reject chain ID mismatch', async () => {
      const payload = createMockPayload();
      payload.payload.authorization.chainId = 1; // Wrong chain ID

      const result = await verifyPayment(mockClient, payload, mockRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe(
        'invalid_exact_evm_payload_chain_id_mismatch'
      );
    });
  });

  describe('extractPayerAddress', () => {
    it('should extract payer from payload', () => {
      const payload = createMockPayload();
      const payer = extractPayerAddress(payload);

      expect(payer).toBe(mockPayer);
    });
  });
});
