import {
  createInterface,
  type Interface as RlInterface,
} from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { config } from 'dotenv';
import {
  createAgentWallet,
  signPaymentPayload,
  signPermitIfApplicable,
  encodePaymentPayload,
  decodePaymentRequired,
  PAYMENT_HEADERS,
  type PaymentRequired,
} from './payment-client.ts';
import {
  createChatSession,
  sendMessage,
  sendToolResult,
  DEFAULT_MODEL,
} from './gemini.ts';
config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
const SENDER_PRIVATE_KEY = (process.env.SENDER_PRIVATE_KEY ??
  '') as `0x${string}`;
const BACKEND_URL = (
  process.env.BACKEND_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

function hr(char = '─', len = 60) {
  return char.repeat(len);
}

function formatAmount(amount: string, decimals = 6): string {
  const val = Number(amount) / Math.pow(10, decimals);
  return val.toFixed(val < 0.01 ? 6 : 3);
}

function printBanner() {
  console.log('');
  console.log(hr('═'));
  console.log('  Gemini x402 Weather Agent');
  console.log(hr('═'));
  console.log(`  Model:    ${GEMINI_MODEL}`);
  console.log(`  Backend:  ${BACKEND_URL}`);
  console.log(`  Network:  Base Sepolia (eip155:84532)`);
  console.log(`  Wallet:   ${SENDER_PRIVATE_KEY ? '✓ loaded' : '✗ MISSING'}`);
  console.log(hr('═'));
  console.log('  Type "exit" or "quit" to stop.');
  console.log(hr('─'));
  console.log('');
}

function printPaymentDetails(paymentRequired: PaymentRequired) {
  const req = paymentRequired.accepts[0];
  if (!req) return;

  const symbol = req.extra?.symbol ?? 'USDC';
  const decimals = req.extra?.decimals ?? 6;
  const amount = formatAmount(req.amount, decimals);
  const shortAsset = req.asset
    ? `${req.asset.slice(0, 10)}...${req.asset.slice(-4)}`
    : 'native';
  const shortRecipient = `${req.payTo.slice(0, 10)}...${req.payTo.slice(-4)}`;
  const contractAddr = req.extra?.creContract
    ? `${req.extra.creContract.slice(0, 10)}...${req.extra.creContract.slice(-4)}`
    : 'n/a';

  console.log('');
  console.log('  ┌─ Payment Required ───────────────────────────────────┐');
  console.log(
    `  │  Amount:    ${amount} ${symbol.padEnd(10)}                      │`
  );
  console.log(`  │  Token:     ${shortAsset.padEnd(40)} │`);
  console.log(`  │  Network:   ${req.network.padEnd(40)} │`);
  console.log(`  │  Recipient: ${shortRecipient.padEnd(40)} │`);
  console.log(`  │  Settled:   Chainlink CRE (${contractAddr.padEnd(23)})  │`);
  console.log('  └──────────────────────────────────────────────────────┘');
  console.log('');
}

interface SettleResponse {
  success: boolean;
  transaction: string;
  errorReason?: string;
  network?: string;
}

/**
 * Subscribe to the SSE settlement stream and print updates.
 * Awaited — the prompt only appears after settlement is confirmed.
 */
async function watchSettlement(settlementId: string): Promise<void> {
  const url = `${BACKEND_URL}/api/weather/settlement?id=${settlementId}`;

  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let eventType = '';
      let dataLine = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataLine = line.slice(6).trim();
        } else if (line === '' && eventType && dataLine) {
          handleSSEEvent(eventType, dataLine);
          if (eventType === 'settlement_complete') {
            reader.cancel();
            return;
          }
          eventType = '';
          dataLine = '';
        }
      }
    }
  } catch {
    // SSE errors are non-critical — don't crash the agent
  }
}

function handleSSEEvent(event: string, data: string) {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;

    if (event === 'settlement_update') {
      const msg =
        (parsed.message as string | undefined) ?? 'Settlement in progress...';
      console.log(`  [Settlement] ${msg}`);
    } else if (event === 'settlement_complete') {
      const success = parsed.success as boolean | undefined;
      const txHash = parsed.transaction as string | undefined;
      const reason = parsed.errorReason as string | undefined;

      if (success && txHash && txHash !== '') {
        console.log(
          `  [Settlement] Done — tx: https://sepolia.basescan.org/tx/${txHash}`
        );
      } else if (reason === 'cre_cli_unavailable') {
        console.log(
          '  [Settlement] Simulated (CRE CLI not installed — payment verified, no broadcast)'
        );
      } else {
        console.log(`  [Settlement] ${reason ?? 'Complete'}`);
      }
      console.log('');
    }
  } catch {
    // ignore parse errors
  }
}

// ── x402 payment flow ─────────────────────────────────────────────────────────

interface WeatherPaymentResult {
  data: unknown;
  settlementId: string | null;
}

async function executeWeatherPayment(
  rl: RlInterface,
  walletClient: ReturnType<typeof createAgentWallet>['walletClient'],
  toolArgs: Record<string, unknown>
): Promise<WeatherPaymentResult> {
  console.log(
    `\n  [Agent] Gemini wants to call: get_weather(${JSON.stringify(toolArgs)})`
  );

  // Build URL — pass the user's query as ?q= so the backend can geocode it
  const query = typeof toolArgs.query === 'string' ? toolArgs.query.trim() : '';
  const weatherUrl = query
    ? `${BACKEND_URL}/api/weather?q=${encodeURIComponent(query)}`
    : `${BACKEND_URL}/api/weather`;

  console.log(`  [Agent] Fetching payment requirements from ${weatherUrl}...`);

  // Step 1: Initial request — expect 402
  const initialRes = await fetch(weatherUrl);

  if (initialRes.status !== 402) {
    if (initialRes.ok) {
      const data = (await initialRes.json()) as Record<string, unknown>;
      console.log('  [Agent] API returned data without payment (unexpected).');
      return { data, settlementId: null };
    }
    throw new Error(`Unexpected status from backend: ${initialRes.status}`);
  }

  // Step 2: Decode payment requirements
  const paymentRequiredHeader = initialRes.headers.get(
    PAYMENT_HEADERS.REQUIRED
  );
  if (!paymentRequiredHeader) {
    throw new Error('Backend returned 402 but missing PAYMENT-REQUIRED header');
  }

  const paymentRequired = decodePaymentRequired(paymentRequiredHeader);
  const requirements = paymentRequired.accepts[0];
  if (!requirements) {
    throw new Error('No payment options in server 402 response');
  }

  // Step 3: Show payment details and ask for confirmation
  printPaymentDetails(paymentRequired);

  const confirm = await rl.question('  Confirm payment? (y/n): ');
  console.log('');

  if (confirm.trim().toLowerCase() !== 'y') {
    console.log('  [Agent] Payment declined by user.\n');
    return {
      data: { error: 'Payment declined by user', weather: null },
      settlementId: null,
    };
  }

  // Step 4: Sign EIP-712 authorization
  console.log('  [Agent] Signing EIP-712 authorization...');
  const payload = await signPaymentPayload(walletClient, requirements);

  // Step 5: Sign EIP-2612 permit (gasless USDC approval — non-critical)
  console.log('  [Agent] Signing EIP-2612 permit (gasless USDC approval)...');
  await signPermitIfApplicable(walletClient, requirements, payload);

  // Step 6: Retry with payment signature (same URL with location params)
  console.log('  [Agent] Submitting payment to backend...');
  const paymentSignature = encodePaymentPayload(payload);

  const paidRes = await fetch(weatherUrl, {
    headers: { [PAYMENT_HEADERS.SIGNATURE]: paymentSignature },
  });

  if (!paidRes.ok) {
    const body = (await paidRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      body.error ?? `Payment rejected: ${paidRes.status} ${paidRes.statusText}`
    );
  }

  const data = (await paidRes.json()) as {
    success: boolean;
    data: Record<string, unknown>;
    message: string;
    payer?: string;
    settlementId?: string;
  };

  return { data: data.data, settlementId: data.settlementId ?? null };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Validate config
  if (!GEMINI_API_KEY) {
    console.error(
      'ERROR: GEMINI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey'
    );
    console.error('       Then set it in examples/agent/.env');
    process.exit(1);
  }
  if (!SENDER_PRIVATE_KEY || SENDER_PRIVATE_KEY === '0x') {
    console.error(
      'ERROR: SENDER_PRIVATE_KEY is not set. Set it in examples/agent/.env'
    );
    process.exit(1);
  }

  printBanner();

  // Create viem wallet
  const { walletClient } = createAgentWallet(SENDER_PRIVATE_KEY);

  // Start Gemini chat session
  const chat = createChatSession(GEMINI_API_KEY, GEMINI_MODEL);

  // Create a single readline interface for the whole session
  const rl = createInterface({ input, output });

  process.on('SIGINT', () => {
    console.log('\n\nGoodbye!\n');
    rl.close();
    process.exit(0);
  });

  // Conversation loop
  while (true) {
    let userInput: string;
    try {
      userInput = await rl.question('You: ');
    } catch {
      break;
    }

    const trimmed = userInput.trim();
    if (!trimmed) continue;
    if (['exit', 'quit', 'bye'].includes(trimmed.toLowerCase())) {
      console.log('\nGoodbye!\n');
      break;
    }

    try {
      // Send to Gemini
      const response = await sendMessage(chat, trimmed);

      if (response.type === 'text') {
        // Conversational reply
        console.log(`\nGemini: ${response.text}\n`);
        continue;
      }

      // Tool call — only get_weather is registered
      if (response.type === 'tool_call' && response.name === 'get_weather') {
        let toolResult: unknown;
        let settlementId: string | null = null;

        try {
          const result = await executeWeatherPayment(
            rl,
            walletClient,
            response.args
          );
          toolResult = result.data;
          settlementId = result.settlementId;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`\n  [Error] ${msg}\n`);
          toolResult = { error: msg, weather: null };
        }

        // Wait for settlement before showing the weather response
        if (settlementId) {
          console.log(
            '  [Settlement] Waiting for Chainlink CRE confirmation...'
          );
          await watchSettlement(settlementId).catch(() => {});
        }

        // Feed result back to Gemini and get the natural-language reply
        const finalReply = await sendToolResult(
          chat,
          response.name,
          toolResult
        );
        console.log(`\nAgent: ${finalReply}\n`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  [Error] ${msg}\n`);
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
