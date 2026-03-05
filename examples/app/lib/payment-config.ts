/**
 * Shared payment configuration for the Chainlink x402 starter kit.
 *
 * Defines the payment requirements served to clients on 402 responses.
 * Using Base Sepolia testnet with USDC micropayments.
 */

import type { PaymentRequirements } from "x402-chainlink";
import { FACILITATOR_DEPLOYMENTS } from "x402-chainlink";

export const NETWORK = "eip155:84532" as const; // Base Sepolia

export const USDC_PRICE_MICRO = "1000"; // 0.001 USDC (6 decimals)

export function getWeatherPaymentRequirements(): PaymentRequirements {
  const receiverAddress = process.env.RECEIVER_ADDRESS as `0x${string}`;
  const facilitatorAddress = (process.env.FACILITATOR_ADDRESS ??
    FACILITATOR_DEPLOYMENTS[NETWORK]?.address) as `0x${string}`;

  if (!receiverAddress) {
    throw new Error("RECEIVER_ADDRESS environment variable is not set");
  }

  return {
    scheme: "exact",
    network: NETWORK,
    amount: USDC_PRICE_MICRO,
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    payTo: receiverAddress,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 6,
      creContract: facilitatorAddress,
    },
  };
}

export const EXPLORER_BASE_URL = "https://sepolia.basescan.org";
