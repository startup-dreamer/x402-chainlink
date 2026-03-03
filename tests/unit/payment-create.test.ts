/**
 * Payment creation tests for EVM with EIP-712 signing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  createPaymentPayload,
  buildPaymentTypedData,
  encodePaymentSignature,
  decodePaymentSignature,
  encodePaymentRequired,
  decodePaymentRequired,
} from '../../src/payment/create.js';
import type {
  PaymentRequirements,
  PaymentRequired,
} from '../../src/types/index.js';

// Test private key (DO NOT USE IN PRODUCTION)
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

describe('Payment Creation (EVM)', () => {
  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http('http://localhost:8545'),
  });

  const mockRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: 'eip155:84532',
    amount: '1000000', // 1 USDC (6 decimals)
    asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
    payTo: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`,
    maxTimeoutSeconds: 300,
    extra: {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
    },
  };

  describe('createPaymentPayload', () => {
    it('should create a valid payment payload', async () => {
      const payload = await createPaymentPayload(
        walletClient,
        2,
        mockRequirements,
        {
          endpoint: 'https://cre.example.com',
          network: 'eip155:84532',
        }
      );

      expect(payload.x402Version).toBe(2);
      expect(payload.accepted).toEqual(mockRequirements);
      expect(payload.payload.signature).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(payload.payload.authorization.from).toBe(account.address);
      expect(payload.payload.authorization.to).toBe(mockRequirements.payTo);
      expect(payload.payload.authorization.amount).toBe(
        mockRequirements.amount
      );
      expect(payload.creEndpoint).toBe('https://cre.example.com');
    });

    it('should include EIP-712 typed data', async () => {
      const payload = await createPaymentPayload(
        walletClient,
        2,
        mockRequirements,
        {
          endpoint: 'https://cre.example.com',
          network: 'eip155:84532',
        }
      );

      expect(payload.typedData).toBeDefined();
      expect(payload.typedData?.domain.name).toBe('x402-chainlink');
      expect(payload.typedData?.domain.version).toBe('1');
      expect(payload.typedData?.domain.chainId).toBe(84532);
      expect(payload.typedData?.primaryType).toBe('PaymentAuthorization');
    });

    it('should generate unique nonces', async () => {
      const payload1 = await createPaymentPayload(
        walletClient,
        2,
        mockRequirements,
        { endpoint: '', network: 'eip155:84532' }
      );

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      const payload2 = await createPaymentPayload(
        walletClient,
        2,
        mockRequirements,
        { endpoint: '', network: 'eip155:84532' }
      );

      expect(payload1.payload.authorization.nonce).not.toBe(
        payload2.payload.authorization.nonce
      );
    });

    it('should handle native ETH payments (null asset)', async () => {
      const ethRequirements: PaymentRequirements = {
        ...mockRequirements,
        asset: null,
        extra: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      };

      const payload = await createPaymentPayload(
        walletClient,
        2,
        ethRequirements,
        { endpoint: '', network: 'eip155:84532' }
      );

      expect(payload.payload.authorization.token).toBeNull();
    });
  });

  describe('buildPaymentTypedData', () => {
    it('should build correct EIP-712 typed data', () => {
      const typedData = buildPaymentTypedData(
        mockRequirements,
        account.address,
        '12345',
        '1700000000',
        '0x0000000000000000000000000000000000000000' as `0x${string}`
      );

      expect(typedData.domain.name).toBe('x402-chainlink');
      expect(typedData.domain.chainId).toBe(84532);
      expect(typedData.types.PaymentAuthorization).toBeDefined();
      expect(typedData.message.from).toBe(account.address);
      expect(typedData.message.to).toBe(mockRequirements.payTo);
    });
  });

  describe('Header Encoding/Decoding', () => {
    it('should encode and decode payment signature', async () => {
      const payload = await createPaymentPayload(
        walletClient,
        2,
        mockRequirements,
        { endpoint: '', network: 'eip155:84532' }
      );

      const encoded = encodePaymentSignature(payload);
      expect(encoded).toBeTruthy();

      const decoded = decodePaymentSignature(encoded);
      expect(decoded.x402Version).toBe(payload.x402Version);
      expect(decoded.payload.signature).toBe(payload.payload.signature);
    });

    it('should encode and decode payment required', () => {
      const paymentRequired: PaymentRequired = {
        x402Version: 2,
        resource: {
          url: '/api/test',
          description: 'Test resource',
        },
        accepts: [mockRequirements],
      };

      const encoded = encodePaymentRequired(paymentRequired);
      expect(encoded).toBeTruthy();

      const decoded = decodePaymentRequired(encoded);
      expect(decoded.x402Version).toBe(2);
      expect(decoded.accepts.length).toBe(1);
      expect(decoded.accepts[0]?.amount).toBe(mockRequirements.amount);
    });
  });
});
