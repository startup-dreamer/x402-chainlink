import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { createServer } from 'http';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { readFileSync } from 'fs';
import { EventEmitter } from 'events';
import { createRequire } from 'module';
import { dirname, join } from 'path';
import {
  verifyPayment,
  settlePayment,
  createProvider,
  buildUSDCPayment,
  buildLINKPayment,
  encodePaymentRequired,
  encodePaymentResponse,
  decodePaymentSignature,
  HTTP_HEADERS,
  type PaymentPayload,
  type PaymentRequirements,
  type PaymentRequired,
  type SettleResponse,
} from 'x402-chainlink';

try {
  const envPath = new URL('./.env.local', import.meta.url);
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log('✅ Loaded env from .env.local');
} catch {
  console.log('⚠️  No .env.local found, using environment variables');
}

const PORT = process.env.EXPRESS_PORT ?? 3001;
const RECIPIENT_ADDRESS = (process.env.RECEIVER_ADDRESS ??
  process.env.RECIPIENT_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
const FACILITATOR_ADDRESS = (process.env.FACILITATOR_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
const NETWORK = 'eip155:84532' as const; // Base Sepolia

const BROADCAST_ENABLED = process.env.CRE_BROADCAST === 'true';
const CRE_TARGET = process.env.CRE_TARGET ?? 'staging-settings';

// Resolve workflow path: prefer env var, otherwise auto-detect from installed x402-chainlink package
function resolveWorkflowPath(): string {
  // if (process.env.WORKFLOW_PATH) return process.env.WORKFLOW_PATH;
  try {
    const require = createRequire(import.meta.url);
    const pkgJson = require.resolve('x402-chainlink/package.json');
    return join(dirname(pkgJson), 'x402-workflow');
  } catch {
    return './node_modules/x402-chainlink/x402-workflow';
  }
}
const WORKFLOW_PATH = resolveWorkflowPath();
const EXPLORER_BASE_URL = 'https://sepolia.basescan.org';

const USDC_BASE_SEPOLIA =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

// Viem public client
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Provider via x402-chainlink helper (used for weather settlement)
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

/**
 * Map from settlementId → EventEmitter.
 * Each connected SSE client subscribes to its own emitter.
 */
const settlementBus = new Map<string, EventEmitter>();

function getOrCreateEmitter(id: string): EventEmitter {
  let emitter = settlementBus.get(id);
  if (!emitter) {
    emitter = new EventEmitter();
    settlementBus.set(id, emitter);
  }
  return emitter;
}

function cleanupEmitter(id: string) {
  settlementBus.delete(id);
}

interface PaymentRequest extends Request {
  payment?: {
    payload: PaymentPayload;
    requirements: PaymentRequirements;
  };
}

function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    `Content-Type, ${HTTP_HEADERS.PAYMENT_SIGNATURE}, ${HTTP_HEADERS.PAYMENT_REQUIRED}, ${HTTP_HEADERS.PAYMENT_RESPONSE}`
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    `${HTTP_HEADERS.PAYMENT_REQUIRED}, ${HTTP_HEADERS.PAYMENT_RESPONSE}`
  );
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function requirePayment(
  requirements: PaymentRequirements
): (req: PaymentRequest, res: Response, next: NextFunction) => Promise<void> {
  return async (
    req: PaymentRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const paymentSignatureHeader = req.get(HTTP_HEADERS.PAYMENT_SIGNATURE);

      if (!paymentSignatureHeader) {
        sendPaymentRequired(res, req, requirements);
        return;
      }

      const payload = decodePaymentSignature(paymentSignatureHeader);
      const verification = await verifyPayment(client, payload, requirements);

      const hasPermit = !!(payload.payload as { permit?: unknown }).permit;
      const permitBypassesAllowance =
        verification.invalidReason === 'insufficient_allowance' && hasPermit;

      if (!verification.isValid && !permitBypassesAllowance) {
        sendPaymentRequired(res, req, requirements, verification.invalidReason);
        return;
      }

      req.payment = { payload, requirements };
      next();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      sendPaymentRequired(res, req, requirements, `Error: ${msg}`);
    }
  };
}

function sendPaymentRequired(
  res: Response,
  req: Request,
  requirements: PaymentRequirements,
  error?: string
): void {
  const paymentRequired: PaymentRequired = {
    x402Version: 2,
    error,
    resource: {
      url: req.originalUrl,
      description: 'Payment required to access this resource',
    },
    accepts: [requirements],
  };

  res
    .status(402)
    .set(HTTP_HEADERS.PAYMENT_REQUIRED, encodePaymentRequired(paymentRequired))
    .json({ error: error ?? 'Payment Required', details: paymentRequired });
}

async function runSettlement(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  settlementId: string
): Promise<void> {
  const emitter = getOrCreateEmitter(settlementId);

  emitter.emit('update', {
    status: 'settling',
    message: 'Settlement initiated via Chainlink CRE',
  });

  let result: SettleResponse;

  try {
    result = await settlePayment(publicClient, payload, requirements, {
      simulation: true,
      skipVerification: true,
      creConfig: {
        endpoint: 'cli://simulation',
        network: requirements.network,
        facilitatorAddress: FACILITATOR_ADDRESS,
        simulation: true,
        workflowPath: WORKFLOW_PATH,
        targetSettings: CRE_TARGET,
        broadcastInSimulation: BROADCAST_ENABLED,
        engineLogs: true,
        timeout: 60000,
      },
    });

    if (result.success) {
      console.log(
        `✅ Settlement successful [${settlementId}]: ${result.transaction}` +
          (BROADCAST_ENABLED
            ? ` | ${EXPLORER_BASE_URL}/tx/${result.transaction}`
            : '')
      );
    } else {
      console.warn(
        `⚠️  Settlement failed [${settlementId}]: ${result.errorReason}`
      );
    }
  } catch (caughtErr) {
    const e = caughtErr as Error & { details?: Record<string, unknown> };
    console.warn('⚠️  CRE workflow error:', e.message);

    if (e.details) {
      const { stdout, stderr, logs } = e.details as {
        stdout?: string;
        stderr?: string;
        logs?: string[];
      };
      if (stdout?.trim()) {
        console.log('\n─── CRE CLI stdout ───────────────────────────────────');
        console.log(stdout.trim());
      }
      if (stderr?.trim()) {
        console.log('\n─── CRE CLI stderr ───────────────────────────────────');
        console.log(stderr.trim());
      }
      if (logs?.length) {
        console.log('\n─── CRE CLI log lines ────────────────────────────────');
        logs.forEach((l) => console.log(l));
      }
      console.log('──────────────────────────────────────────────────────\n');
    }

    result = {
      success: false,
      errorReason: e.message.startsWith('CRE CLI not found')
        ? 'cre_cli_unavailable'
        : `cre_workflow_failed: ${e.message}`,
      transaction: '',
      network: requirements.network,
    };
  }

  emitter.emit('complete', result);
  setTimeout(() => cleanupEmitter(settlementId), 10_000);
}

const app = express();
app.use(express.json());
app.use(corsMiddleware);

app.get('/', (_req, res) => {
  res.json({
    name: 'x402 Express API (Chainlink CRE)',
    version: '1.0.0',
    network: NETWORK,
    recipient: RECIPIENT_ADDRESS,
    endpoints: {
      'GET /': 'API info (free)',
      'GET /api/free': 'Free endpoint',
      'GET /api/weather': 'Weather data (0.001 USDC) — x402 protected',
      'GET /api/weather/settlement':
        'SSE stream for settlement status (?id=<settlementId>)',
      'GET /api/premium': 'Premium content ($0.01 USDC)',
      'GET /api/expensive': 'Expensive content (0.001 LINK)',
    },
  });
});

app.get('/api/free', (_req, res) => {
  res.json({
    message: 'This is free content!',
    timestamp: new Date().toISOString(),
  });
});

const weatherRequirements: PaymentRequirements = {
  scheme: 'exact',
  network: NETWORK,
  amount: '1000',
  asset: USDC_BASE_SEPOLIA,
  payTo: RECIPIENT_ADDRESS,
  maxTimeoutSeconds: 300,
  extra: {
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    creContract: FACILITATOR_ADDRESS,
  },
};

app.get(
  '/api/weather',
  requirePayment(weatherRequirements),
  async (req: PaymentRequest, res: Response): Promise<void> => {
    if (!req.payment) {
      res.status(500).json({ error: 'Payment missing' });
      return;
    }

    const { payload } = req.payment;
    const settlementId = crypto.randomUUID();

    res.json({
      success: true,
      data: { ...weatherData, lastUpdated: new Date().toISOString() },
      message: 'Weather data retrieved. Protected by x402 via Chainlink CRE.',
      payer: payload.payload.authorization.from,
      settlementId,
    });

    runSettlement(payload, weatherRequirements, settlementId).catch(
      console.error
    );
  }
);

app.get('/api/weather/settlement', (req: Request, res: Response): void => {
  const { id } = req.query as { id?: string };

  if (!id) {
    res.status(400).json({ error: 'Missing ?id= query param' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('connected', {
    settlementId: id,
    message: 'Subscribed to settlement updates',
  });

  const emitter = getOrCreateEmitter(id);

  const onUpdate = (data: unknown) => {
    send('settlement_update', data);
  };

  const onComplete = (result: SettleResponse) => {
    send('settlement_complete', result);
    res.end();
    emitter.off('update', onUpdate);
    emitter.off('complete', onComplete);
  };

  emitter.on('update', onUpdate);
  emitter.on('complete', onComplete);

  req.on('close', () => {
    emitter.off('update', onUpdate);
    emitter.off('complete', onComplete);
  });

  const timeout = setTimeout(() => {
    send('settlement_complete', {
      success: false,
      errorReason: 'timeout',
      transaction: '',
      network: NETWORK,
    });
    res.end();
    emitter.off('update', onUpdate);
    emitter.off('complete', onComplete);
  }, 90_000);

  res.on('close', () => clearTimeout(timeout));
});

const premiumRequirements = buildUSDCPayment({
  network: NETWORK,
  amount: 0.01,
  payTo: RECIPIENT_ADDRESS,
  maxTimeoutSeconds: 300,
});

app.get(
  '/api/premium',
  requirePayment(premiumRequirements),
  async (req: PaymentRequest, res: Response): Promise<void> => {
    const settlementId = crypto.randomUUID();

    res.json({
      message: 'Welcome to the premium API!',
      secret: 'The answer is 42',
      payer: req.payment?.payload.payload.authorization.from,
      timestamp: new Date().toISOString(),
      settlementId,
    });

    if (req.payment) {
      runSettlement(
        req.payment.payload,
        premiumRequirements,
        settlementId
      ).catch(console.error);
    }
  }
);

const expensiveRequirements = buildLINKPayment({
  network: NETWORK,
  amount: 0.001,
  payTo: RECIPIENT_ADDRESS,
  maxTimeoutSeconds: 300,
});

app.get(
  '/api/expensive',
  requirePayment(expensiveRequirements),
  async (req: PaymentRequest, res: Response): Promise<void> => {
    const settlementId = crypto.randomUUID();

    res.json({
      message: 'Welcome to the exclusive API!',
      data: {
        value: 'This is very valuable data',
        analysis: 'Deep insights here',
      },
      payer: req.payment?.payload.payload.authorization.from,
      timestamp: new Date().toISOString(),
      settlementId,
    });

    if (req.payment) {
      runSettlement(
        req.payment.payload,
        expensiveRequirements,
        settlementId
      ).catch(console.error);
    }
  }
);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n Port ${PORT} is already in use.`);
    console.error(
      `   Kill the process holding it with: lsof -ti :${PORT} | xargs kill`
    );
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log('🚀 x402 Express API Server (Chainlink CRE)');
  console.log('='.repeat(52));
  console.log(`📍 Listening on  http://localhost:${PORT}`);
  console.log(`💰 Recipient:    ${RECIPIENT_ADDRESS}`);
  console.log(`🏗  Facilitator:  ${FACILITATOR_ADDRESS}`);
  console.log(`🔗 Network:      ${NETWORK}`);
  console.log(
    `📡 Broadcast:    ${BROADCAST_ENABLED ? 'enabled' : 'simulation only'}`
  );
  console.log(`📂 Workflow:     ${WORKFLOW_PATH}`);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down server...');
  server.close(() => process.exit(0));
});
