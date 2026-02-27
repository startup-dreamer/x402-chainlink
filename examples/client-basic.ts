/**
 * Basic x402 Client Example
 *
 * This example demonstrates how to use the x402-chainlink library
 * to make payments for API access using EIP-712 signatures and viem.
 *
 * Key concepts:
 * - Handle 402 Payment Required responses
 * - Sign EIP-712 payment authorization with viem
 * - Retry requests with payment signature
 *
 * @example
 * ```bash
 * # Set environment variables
 * export PRIVATE_KEY=0x...your_private_key
 * export PAYWALL_URL=http://localhost:3000/api/premium
 *
 * # Run with bun
 * bun run examples/client-basic.ts
 * ```
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  createPaymentPayload,
  decodePaymentRequired,
  encodePaymentSignature,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequired,
  type PaymentRequirements,
  DEFAULT_CRE_ENDPOINTS,
} from '../dist/index.js';

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const PAYWALL_URL =
  process.env.PAYWALL_URL ?? 'http://localhost:3000/api/premium';
const NETWORK = 'eip155:84532' as const; // Base Sepolia

class X402Client {
  private walletClient;
  private publicClient;

  constructor() {
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    const account = privateKeyToAccount(PRIVATE_KEY);

    // Create viem clients
    this.publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    this.walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(),
    });

    console.log(`🔑 Wallet address: ${account.address}`);
  }

  /**
   * Make a request to a paywalled endpoint
   */
  async request(url: string): Promise<Response> {
    console.log(`\n📡 Making request to: ${url}`);

    // Step 1: Initial request (may return 402)
    const initialResponse = await fetch(url);

    if (initialResponse.status !== 402) {
      console.log(`✅ Request successful (no payment required)`);
      return initialResponse;
    }

    console.log(`💰 Payment required (402)`);

    // Step 2: Parse payment requirements
    const paymentRequiredHeader = initialResponse.headers.get(
      HTTP_HEADERS.PAYMENT_REQUIRED
    );

    if (!paymentRequiredHeader) {
      throw new Error('Missing PAYMENT-REQUIRED header');
    }

    const paymentRequired = decodePaymentRequired(paymentRequiredHeader);
    console.log(`   Resource: ${paymentRequired.resource.url}`);
    console.log(`   Options: ${paymentRequired.accepts.length}`);

    // Step 3: Select payment option (use first option for simplicity)
    const selectedRequirement = this.selectPaymentOption(paymentRequired);
    console.log(
      `   Selected: ${selectedRequirement.extra?.symbol ?? 'Unknown'}`
    );
    console.log(`   Amount: ${selectedRequirement.amount}`);

    // Step 4: Create and sign payment
    const payload = await this.createPayment(selectedRequirement);
    console.log(`   Signed: ${payload.payload.signature.slice(0, 20)}...`);

    // Step 5: Retry with payment signature
    const paymentSignature = encodePaymentSignature(payload);
    const retryResponse = await fetch(url, {
      headers: {
        [HTTP_HEADERS.PAYMENT_SIGNATURE]: paymentSignature,
      },
    });

    if (retryResponse.ok) {
      console.log(`✅ Payment accepted! Access granted.`);

      // Check for settlement response
      const paymentResponse = retryResponse.headers.get(
        HTTP_HEADERS.PAYMENT_RESPONSE
      );
      if (paymentResponse) {
        console.log(`📝 Settlement info in headers`);
      }
    } else {
      console.log(`❌ Payment rejected: ${retryResponse.status}`);
    }

    return retryResponse;
  }

  /**
   * Select a payment option from the available options
   */
  private selectPaymentOption(
    paymentRequired: PaymentRequired
  ): PaymentRequirements {
    // Filter for matching network
    const matching = paymentRequired.accepts.filter(
      (req) => req.network === NETWORK
    );

    if (matching.length === 0) {
      // Fall back to first option
      const first = paymentRequired.accepts[0];
      if (!first) {
        throw new Error('No payment options available');
      }
      return first;
    }

    // Return first matching option
    return matching[0]!;
  }

  /**
   * Create and sign a payment payload
   */
  private async createPayment(
    requirements: PaymentRequirements
  ): Promise<PaymentPayload> {
    const creEndpoint = DEFAULT_CRE_ENDPOINTS[requirements.network] ?? '';

    const payload = await createPaymentPayload(
      this.walletClient,
      2, // x402 version
      requirements,
      {
        endpoint: creEndpoint,
        network: requirements.network,
        simulation: true, // Use simulation mode for testing
      }
    );

    return payload;
  }
}

async function main() {
  console.log('🚀 x402 Client Example (Chainlink CRE + viem)');
  console.log('='.repeat(50));

  try {
    const client = new X402Client();

    // Make a request to the paywalled endpoint
    const response = await client.request(PAYWALL_URL);

    if (response.ok) {
      const data = await response.text();
      console.log('\n📦 Response:');
      console.log(data);
    } else {
      console.log(`\n❌ Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
