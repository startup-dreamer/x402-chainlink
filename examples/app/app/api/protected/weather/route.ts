/**
 * Payment-protected weather API route.
 *
 * Flow:
 *  1. No PAYMENT-SIGNATURE header → return 402 with payment requirements
 *  2. Has header → verify EIP-712 payment → return weather data
 *  3. Settle payment in background via CRE simulation (optionally broadcasting)
 */

export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPayment,
  settlePayment,
  decodePaymentSignature,
  encodePaymentRequired,
  encodePaymentResponse,
  createProvider,
  HTTP_HEADERS,
  type PaymentRequired,
  type SettleResponse,
} from 'x402-chainlink';
import {
  getWeatherPaymentRequirements,
  EXPLORER_BASE_URL,
  NETWORK,
} from '@/lib/payment-config';

// createProvider returns a PublicClient typed from x402-chainlink's viem — no type conflicts
const publicClient = createProvider(NETWORK);

const weatherData = {
  location: 'San Francisco, CA',
  temperature: 68,
  unit: 'F',
  condition: 'Partly Cloudy',
  humidity: 65,
  windSpeed: 12,
  windDirection: 'NW',
  forecast: [
    { day: 'Monday', high: 70, low: 55, condition: 'Sunny' },
    { day: 'Tuesday', high: 68, low: 54, condition: 'Cloudy' },
    { day: 'Wednesday', high: 72, low: 56, condition: 'Sunny' },
    { day: 'Thursday', high: 69, low: 53, condition: 'Partly Cloudy' },
    { day: 'Friday', high: 67, low: 52, condition: 'Rain' },
  ],
};

export async function GET(request: NextRequest) {
  const paymentSignatureHeader = request.headers.get(
    HTTP_HEADERS.PAYMENT_SIGNATURE
  );

  // ── Step 1: No payment header → return 402 ─────────────────────────────
  if (!paymentSignatureHeader) {
    const requirements = getWeatherPaymentRequirements();

    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: 'Payment required to access weather data',
      resource: {
        url: '/api/protected/weather',
        description: 'Real-time weather data (0.001 USDC per request)',
        mimeType: 'application/json',
      },
      accepts: [requirements],
    };

    return NextResponse.json(
      { error: 'Payment Required', details: paymentRequired },
      {
        status: 402,
        headers: {
          [HTTP_HEADERS.PAYMENT_REQUIRED]:
            encodePaymentRequired(paymentRequired),
        },
      }
    );
  }

  // ── Step 2: Decode + verify payment ────────────────────────────────────
  const requirements = getWeatherPaymentRequirements();

  let payload;
  try {
    payload = decodePaymentSignature(paymentSignatureHeader);
  } catch {
    return NextResponse.json(
      { error: 'Invalid payment signature encoding' },
      { status: 400 }
    );
  }

  const verification = await verifyPayment(publicClient, payload, requirements);

  // Allow permit-based payments: if the only failure is insufficient allowance
  // but the payload includes an EIP-2612 permit, the X402Facilitator will call
  // permit() + transferFrom() atomically — no prior approve() needed.
  const hasPermit = !!(payload.payload as { permit?: unknown }).permit;
  const permitBypassesAllowance =
    verification.invalidReason === 'insufficient_allowance' && hasPermit;

  if (!verification.isValid && !permitBypassesAllowance) {
    const paymentRequired: PaymentRequired = {
      x402Version: 2,
      error: `Payment invalid: ${verification.invalidReason}`,
      resource: { url: '/api/protected/weather' },
      accepts: [requirements],
    };

    return NextResponse.json(
      { error: 'Payment Invalid', reason: verification.invalidReason },
      {
        status: 402,
        headers: {
          [HTTP_HEADERS.PAYMENT_REQUIRED]:
            encodePaymentRequired(paymentRequired),
        },
      }
    );
  }

  if (permitBypassesAllowance) {
    console.log(
      '[x402] Allowance insufficient but EIP-2612 permit present — proceeding with permit-based settlement'
    );
  }

  // ── Step 3: Return weather data immediately ─────────────────────────────
  const responseData = {
    success: true,
    data: { ...weatherData, lastUpdated: new Date().toISOString() },
    message: 'Weather data retrieved. Protected by x402 via Chainlink CRE.',
    payer: verification.payer,
  };

  // ── Step 4: Settle in background (non-blocking) ─────────────────────────
  const broadcastEnabled = process.env.CRE_BROADCAST === 'true';
  const workflowPath =
    process.env.WORKFLOW_PATH ?? '../x402-chainlink/x402-workflow';
  const targetSettings = process.env.CRE_TARGET ?? 'staging-settings';
  const facilitatorAddress = (process.env.FACILITATOR_ADDRESS ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;

  let settlementResult: SettleResponse | null = null;

  try {
    settlementResult = await settlePayment(
      publicClient,
      payload,
      requirements,
      {
        simulation: true,
        skipVerification: true,
        creConfig: {
          endpoint: 'cli://simulation',
          network: requirements.network,
          facilitatorAddress,
          simulation: true,
          workflowPath,
          targetSettings,
          broadcastInSimulation: broadcastEnabled,
          timeout: 60000,
        },
      }
    );

    if (settlementResult.success) {
      console.log(
        `[x402] Settlement successful: ${settlementResult.transaction}` +
          (broadcastEnabled
            ? ` | ${EXPLORER_BASE_URL}/tx/${settlementResult.transaction}`
            : '')
      );
    } else {
      console.warn(`[x402] Settlement failed: ${settlementResult.errorReason}`);
    }
  } catch (err) {
    // CRE CLI may not be installed — log and continue, don't block the response
    console.warn(
      '[x402] Settlement skipped (CRE CLI unavailable):',
      (err as Error).message
    );
    settlementResult = {
      success: false,
      errorReason: 'cre_cli_unavailable',
      transaction: '',
      network: requirements.network,
    };
  }

  // Encode settlement result for client
  const settlementResponse: SettleResponse = settlementResult ?? {
    success: false,
    errorReason: 'settlement_not_attempted',
    transaction: '',
    network: requirements.network,
  };

  return NextResponse.json(responseData, {
    status: 200,
    headers: {
      [HTTP_HEADERS.PAYMENT_RESPONSE]:
        encodePaymentResponse(settlementResponse),
    },
  });
}
