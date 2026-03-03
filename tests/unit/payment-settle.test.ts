/**
 * Payment settlement tests for Chainlink CRE
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import {
  settlePayment,
  verifyAndSettle,
  waitForSettlement,
  createCREConfig,
} from '../../src/payment/settle.js';
import type {
  PaymentPayload,
  PaymentRequirements,
} from '../../src/types/index.js';

// Mock CRE client
vi.mock('../../src/cre/index.js', () => ({
  createCREClient: vi.fn(() => ({
    settle: vi.fn().mockResolvedValue({
      success: true,
      transaction: '0x' + '0'.repeat(64),
      network: 'eip155:84532',
      status: 'confirmed',
      workflowId: 'test-workflow-1',
    }),
    verifyAndSettle: vi.fn().mockResolvedValue({
      verifyResponse: {
        isValid: true,
        payer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      },
      settleResponse: {
        success: true,
        transaction: '0x' + '0'.repeat(64),
        network: 'eip155:84532',
        status: 'confirmed',
      },
    }),
  })),
  createCREClientForNetwork: vi.fn(() => ({
    settle: vi.fn().mockResolvedValue({
      success: true,
      transaction: '0x' + '0'.repeat(64),
      network: 'eip155:84532',
      status: 'confirmed',
    }),
    verifyAndSettle: vi.fn().mockResolvedValue({
      verifyResponse: { isValid: true },
      settleResponse: { success: true, transaction: '0x' + '0'.repeat(64) },
    }),
  })),
}));

describe('Payment Settlement (CRE)', () => {
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

  const createMockPayload = (): PaymentPayload => ({
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
        validUntil: String(Math.floor(Date.now() / 1000) + 3600),
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
      message: {},
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock balance check
    vi.spyOn(mockClient, 'readContract').mockResolvedValue(10000000n);
  });

  describe('settlePayment', () => {
    it('should settle payment with skip verification', async () => {
      const payload = createMockPayload();

      const result = await settlePayment(
        mockClient,
        payload,
        mockRequirements,
        {
          skipVerification: true,
          simulation: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.transaction).toBeDefined();
      expect(result.network).toBe('eip155:84532');
    });

    it('should use simulation mode by default without config', async () => {
      const payload = createMockPayload();

      const result = await settlePayment(
        mockClient,
        payload,
        mockRequirements,
        { skipVerification: true }
      );

      // Should succeed with simulation
      expect(result).toBeDefined();
    });
  });

  describe('verifyAndSettle', () => {
    it('should perform combined verify and settle', async () => {
      const payload = createMockPayload();

      const result = await verifyAndSettle(
        mockClient,
        payload,
        mockRequirements,
        { simulation: true }
      );

      expect(result.verification).toBeDefined();
      expect(result.settlement).toBeDefined();
    });
  });

  describe('createCREConfig', () => {
    it('should create config for a network', () => {
      const config = createCREConfig('eip155:84532');

      expect(config.network).toBe('eip155:84532');
      expect(config.endpoint).toBeDefined();
    });

    it('should override with custom options', () => {
      const config = createCREConfig('eip155:84532', {
        apiKey: 'test-api-key',
        simulation: true,
      });

      expect(config.apiKey).toBe('test-api-key');
      expect(config.simulation).toBe(true);
    });
  });
});
