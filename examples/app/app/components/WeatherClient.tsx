'use client';

/**
 * WeatherClient — Automated payment agent backed by the Express API server.
 *
 * Flow:
 *  1. GET <expressUrl>/api/weather (no payment) → 402 with PAYMENT-REQUIRED
 *  2. Decode payment requirements from header
 *  3. Sign EIP-712 payment authorization + EIP-2612 permit (gasless USDC)
 *  4. Retry: GET <expressUrl>/api/weather with PAYMENT-SIGNATURE header
 *  5. Receive weather data + settlementId in response body
 *  6. Open SSE connection to <expressUrl>/api/weather/settlement?id=<settlementId>
 *  7. Stream real-time settlement updates until settlement_complete event
 */

import { useState, useEffect, useRef } from 'react';
import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  PAYMENT_HEADERS,
  decodePaymentRequired,
  encodePaymentPayload,
  signPaymentPayload,
  signPermit,
  type PaymentRequired,
  type SettleResponse,
} from '@/lib/payment-client';

// USDC on Base Sepolia — EIP-2612 permit domain info
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
const USDC_NAME = 'USDC';
const USDC_VERSION = '2';

// Minimal ABI to read the EIP-2612 nonce
const NONCES_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

interface WeatherDay {
  day: string;
  high: number;
  low: number;
  condition: string;
}

interface WeatherData {
  location: string;
  temperature: number;
  unit: string;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  forecast: WeatherDay[];
  lastUpdated: string;
}

interface ApiResponse {
  success: boolean;
  data: WeatherData;
  message: string;
  payer?: string;
  settlementId?: string;
}

type AgentStep =
  | 'idle'
  | 'requesting'
  | 'signing'
  | 'paying'
  | 'settling'
  | 'done'
  | 'error';

// ── Component ────────────────────────────────────────────────────────────────

export default function WeatherClient() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settlement, setSettlement] = useState<SettleResponse | null>(null);
  const [settlementStatus, setSettlementStatus] = useState<string | null>(null);
  const [agentStep, setAgentStep] = useState<AgentStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentRequired | null>(null);

  // Keep a ref to the active EventSource so we can close it on re-fetch
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clean up SSE on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  const expressUrl =
    (process.env.NEXT_PUBLIC_EXPRESS_URL ?? 'http://localhost:3001').replace(/\/$/, '');

  const subscribeToSettlement = (settlementId: string) => {
    // Close any previous SSE connection
    eventSourceRef.current?.close();

    const url = `${expressUrl}/api/weather/settlement?id=${settlementId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setSettlementStatus('Connected to settlement stream...');
    });

    es.addEventListener('settlement_update', (evt) => {
      try {
        const data = JSON.parse(evt.data) as { message?: string };
        setSettlementStatus(data.message ?? 'Settlement in progress...');
      } catch { /* ignore parse errors */ }
    });

    es.addEventListener('settlement_complete', (evt) => {
      try {
        const result = JSON.parse(evt.data) as SettleResponse;
        setSettlement(result);
        setSettlementStatus(null);
        setAgentStep('done');
      } catch { /* ignore */ }
      es.close();
      eventSourceRef.current = null;
    });

    es.onerror = () => {
      setSettlementStatus(null);
      setAgentStep('done');
      es.close();
      eventSourceRef.current = null;
    };
  };

  const fetchWeather = async () => {
    // Close any existing SSE connection before starting a new fetch
    eventSourceRef.current?.close();
    eventSourceRef.current = null;

    setAgentStep('requesting');
    setError(null);
    setWeather(null);
    setSettlement(null);
    setSettlementStatus(null);
    setPaymentInfo(null);

    const privateKey = process.env.NEXT_PUBLIC_SENDER_PRIVATE_KEY as `0x${string}` | undefined;

    if (!privateKey) {
      setError('NEXT_PUBLIC_SENDER_PRIVATE_KEY is not set. See .env.local.example');
      setAgentStep('error');
      return;
    }

    try {
      // ── Step 1: Initial request (no payment) ───────────────────────────
      const initialResponse = await fetch(`${expressUrl}/api/weather`);

      if (initialResponse.status !== 402) {
        if (initialResponse.ok) {
          const data = (await initialResponse.json()) as ApiResponse;
          setWeather(data.data);
          setAgentStep('done');
        } else {
          throw new Error(`Unexpected status: ${initialResponse.status}`);
        }
        return;
      }

      // ── Step 2: Parse the 402 payment requirements ─────────────────────
      const paymentRequiredHeader = initialResponse.headers.get(
        PAYMENT_HEADERS.REQUIRED
      );
      if (!paymentRequiredHeader) {
        throw new Error('Server returned 402 but missing PAYMENT-REQUIRED header');
      }

      const paymentRequired = decodePaymentRequired(paymentRequiredHeader);
      setPaymentInfo(paymentRequired);

      const requirements = paymentRequired.accepts[0];
      if (!requirements) {
        throw new Error('No payment options available in server response');
      }

      // ── Step 3: Sign EIP-712 payment + EIP-2612 permit ─────────────────
      setAgentStep('signing');

      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(),
      });

      const payload = await signPaymentPayload(walletClient, requirements);

      // Gasless approval via EIP-2612 permit
      const facilitatorAddress = (requirements.extra?.creContract ??
        '0x0000000000000000000000000000000000000000') as `0x${string}`;

      if (
        requirements.asset &&
        requirements.asset.toLowerCase() === USDC_BASE_SEPOLIA.toLowerCase() &&
        facilitatorAddress !== '0x0000000000000000000000000000000000000000'
      ) {
        try {
          const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });
          const nonce = await publicClient.readContract({
            address: USDC_BASE_SEPOLIA,
            abi: NONCES_ABI,
            functionName: 'nonces',
            args: [account.address],
          });

          const permitDeadline = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;
          const permitData = await signPermit(
            walletClient,
            USDC_BASE_SEPOLIA,
            USDC_NAME,
            USDC_VERSION,
            facilitatorAddress,
            requirements.amount,
            84532,
            nonce,
            permitDeadline,
          );

          payload.payload.permit = permitData;
        } catch {
          // Non-critical: permit signing failed, proceed without it
        }
      }

      // ── Step 4: Retry with payment signature ────────────────────────────
      setAgentStep('paying');

      const paymentSignature = encodePaymentPayload(payload);
      const paidResponse = await fetch(`${expressUrl}/api/weather`, {
        headers: { [PAYMENT_HEADERS.SIGNATURE]: paymentSignature },
      });

      if (!paidResponse.ok) {
        const errorBody = (await paidResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          errorBody.error ??
            `Payment rejected: ${paidResponse.status} ${paidResponse.statusText}`
        );
      }

      // ── Step 5: Read response + subscribe to SSE settlement ─────────────
      setAgentStep('settling');

      const data = (await paidResponse.json()) as ApiResponse;
      setWeather(data.data);

      if (data.settlementId) {
        // Subscribe to real-time settlement updates via SSE
        subscribeToSettlement(data.settlementId);
        // agentStep stays 'settling' until settlement_complete arrives
      } else {
        // Fallback: no settlementId, mark done immediately
        setAgentStep('done');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch weather data');
      setAgentStep('error');
    }
  };

  const stepLabel: Record<AgentStep, string> = {
    idle:       'FETCH WEATHER DATA',
    requesting: 'STEP 1/4: REQUESTING...',
    signing:    'STEP 2/4: SIGNING EIP-712 + PERMIT...',
    paying:     'STEP 3/4: SUBMITTING PAYMENT...',
    settling:   'STEP 4/4: AWAITING SETTLEMENT...',
    done:       'FETCH WEATHER DATA',
    error:      'RETRY',
  };

  const isLoading = !['idle', 'done', 'error'].includes(agentStep);

  return (
    <div className="weather-client">
      <div className="header-box">
        <h2>WEATHER SERVICE</h2>
        <span className="badge">SECURED BY X402</span>
      </div>

      <div className="protocol-info">
        <div className="info-row">
          <span className="label">NETWORK:</span>
          <strong>Base Sepolia</strong>
        </div>
        <div className="info-row">
          <span className="label">FEE:</span>
          <strong>0.001 USDC</strong>
        </div>
        <div className="info-row">
          <span className="label">SETTLEMENT:</span>
          <strong>Chainlink CRE</strong>
        </div>
        <div className="info-row">
          <span className="label">SERVER:</span>
          <strong>Express :3001</strong>
        </div>
      </div>

      <button onClick={fetchWeather} disabled={isLoading} className="fetch-button">
        {isLoading ? (
          <span className="loading-text">
            <span className="spinner" />
            {stepLabel[agentStep]}
          </span>
        ) : (
          stepLabel[agentStep]
        )}
      </button>

      {/* Agent step tracker */}
      {isLoading && (
        <div className="agent-steps">
          <div className={`step ${ ['requesting', 'signing', 'paying', 'settling'].includes(agentStep) ? 'active' : '' }`}>
            1. Request endpoint
          </div>
          <div className={`step ${ ['signing', 'paying', 'settling'].includes(agentStep) ? 'active' : '' }`}>
            2. Sign EIP-712 + permit
          </div>
          <div className={`step ${ ['paying', 'settling'].includes(agentStep) ? 'active' : '' }`}>
            3. Retry with signature
          </div>
          <div className={`step ${ agentStep === 'settling' ? 'active' : '' }`}>
            4. Stream settlement via SSE
          </div>
        </div>
      )}

      {/* Real-time settlement status (while settling) */}
      {settlementStatus && agentStep === 'settling' && (
        <div className="agent-steps">
          <div className="step active">{settlementStatus}</div>
        </div>
      )}

      {/* Error box */}
      {error && (
        <div className="error-box">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Payment requirements info */}
      {paymentInfo && agentStep !== 'idle' && (
        <div className="payment-info-box">
          <span className="label">REQUIRED:</span>
          <span>
            {paymentInfo.accepts[0]?.extra?.symbol ?? 'USDC'} on{' '}
            {paymentInfo.accepts[0]?.network ?? 'Base Sepolia'}
          </span>
        </div>
      )}

      {/* Settlement result */}
      {settlement && agentStep === 'done' && (
        <div className={settlement.success ? 'success-box' : 'warning-box'}>
          {settlement.success ? (
            <>
              <strong>PAYMENT SETTLED</strong>
              {settlement.transaction && settlement.transaction !== '' ? (
                <a
                  href={`https://sepolia.basescan.org/tx/${settlement.transaction}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  VIEW ON BASESCAN ↗
                </a>
              ) : (
                <span className="tx-simulated">SIMULATED (no broadcast)</span>
              )}
            </>
          ) : (
            <>
              <strong>PAYMENT VERIFIED</strong>
              <span className="tx-simulated">
                {settlement.errorReason === 'cre_cli_unavailable'
                  ? 'CRE CLI not installed — settlement simulated'
                  : (settlement.errorReason ?? 'Settlement pending')}
              </span>
            </>
          )}
        </div>
      )}

      {/* Weather data */}
      {weather && (
        <div className="weather-data-container">
          <div className="location-bar">
            <h3>{weather.location.toUpperCase()}</h3>
          </div>

          <div className="current-stats">
            <div className="main-temp">
              <span className="temp-value">
                {weather.temperature}°{weather.unit}
              </span>
              <span className="condition-text">
                {weather.condition.toUpperCase()}
              </span>
            </div>

            <div className="sub-stats">
              <div className="stat-line">
                <span>HUMIDITY</span>
                <span>{weather.humidity}%</span>
              </div>
              <div className="stat-line">
                <span>WIND</span>
                <span>{weather.windSpeed} MPH {weather.windDirection}</span>
              </div>
            </div>
          </div>

          <div className="forecast-section">
            <h4>EXTENDED FORECAST</h4>
            <div className="forecast-grid">
              {weather.forecast.map((day) => (
                <div key={day.day} className="forecast-item">
                  <span className="day-name">{day.day.slice(0, 3).toUpperCase()}</span>
                  <span className="day-cond">{day.condition.toUpperCase()}</span>
                  <span className="day-temp">{day.high}° / {day.low}°</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
