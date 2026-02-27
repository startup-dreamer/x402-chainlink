import express, { type Request, type Response } from 'express';
import {
  createCREClientForNetwork,
  type PaymentPayload,
  type PaymentRequirements,
  type VerifyResponse,
  type SettleResponse,
  type SupportedResponse,
  type EVMNetworkId,
  EVM_NETWORKS,
} from '../src/index.js';
import type { CREClient } from '../src/cre/client.js';

const PORT = process.env.PORT ?? 3001;

/**
 * Pre-built CRE clients keyed by network ID.
 *
 * Testnets run in simulation mode; mainnets hit the live CRE endpoint.
 * Adjust `simulation` and `endpoint`/`apiKey` options to match your deployment.
 */
const CRE_CLIENTS: Partial<Record<EVMNetworkId, CREClient>> = {
  'eip155:84532': createCREClientForNetwork('eip155:84532', { simulation: true }),
  'eip155:11155111': createCREClientForNetwork('eip155:11155111', { simulation: true }),
  'eip155:8453': createCREClientForNetwork('eip155:8453', { simulation: false }),
  'eip155:1': createCREClientForNetwork('eip155:1', { simulation: false }),
};

/**
 * Resolve a CRE client for the given network, falling back to Base Sepolia
 * (simulation) if the network is not explicitly configured.
 */
function getCREClient(network: EVMNetworkId): CREClient {
  return CRE_CLIENTS[network] ?? (CRE_CLIENTS['eip155:84532'] as CREClient);
}

const app = express();
app.use(express.json());

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', version: '1.0.0' });
});

/**
 * GET /supported - List supported payment kinds
 */
app.get('/supported', (_req, res) => {
  const response: SupportedResponse = {
    kinds: EVM_NETWORKS.map((network) => ({
      x402Version: 2,
      scheme: 'exact' as const,
      network,
    })),
    extensions: [],
    signers: {
      'eip155:*': ['eip712'],
    },
  };

  res.json(response);
});

/**
 * POST /verify - Verify a payment payload via Chainlink CRE
 *
 * The CRE workflow running on the DON performs all signature, balance, and
 * allowance checks. No local EVM calls are made by this server.
 */
app.post('/verify', async (req: Request, res: Response) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({
        isValid: false,
        invalidReason: 'invalid_payload',
        details: { error: 'Missing paymentPayload or paymentRequirements' },
      } satisfies VerifyResponse);
      return;
    }

    const creClient = getCREClient(paymentRequirements.network);
    const result = await creClient.verify(paymentPayload, paymentRequirements);

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      isValid: false,
      invalidReason: 'unexpected_verify_error',
      details: { error: errorMessage },
    } satisfies VerifyResponse);
  }
});

/**
 * POST /settle - Settle a verified payment via Chainlink CRE
 *
 * The CRE workflow on the DON submits the settlement report through the
 * KeystoneForwarder to the X402Facilitator contract.
 */
app.post('/settle', async (req: Request, res: Response) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({
        success: false,
        errorReason: 'Missing paymentPayload or paymentRequirements',
        transaction: '',
        network: 'eip155:84532' as EVMNetworkId,
      } satisfies SettleResponse);
      return;
    }

    const creClient = getCREClient(paymentRequirements.network);
    const result = await creClient.settle(paymentPayload, paymentRequirements);

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      errorReason: errorMessage,
      transaction: '',
      network: 'eip155:84532' as EVMNetworkId,
    } satisfies SettleResponse);
  }
});

/**
 * POST /verify-and-settle - Verify and settle atomically via Chainlink CRE
 *
 * Uses a single CRE workflow execution to verify then settle in one round-trip
 * to the DON, reducing latency compared to calling /verify and /settle separately.
 */
app.post('/verify-and-settle', async (req: Request, res: Response) => {
  try {
    const { paymentPayload, paymentRequirements } = req.body as {
      paymentPayload: PaymentPayload;
      paymentRequirements: PaymentRequirements;
    };

    if (!paymentPayload || !paymentRequirements) {
      res.status(400).json({
        verification: {
          isValid: false,
          invalidReason: 'invalid_payload',
          details: { error: 'Missing paymentPayload or paymentRequirements' },
        },
      });
      return;
    }

    const creClient = getCREClient(paymentRequirements.network);
    const result = await creClient.verifyAndSettle(
      paymentPayload,
      paymentRequirements
    );

    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      verification: {
        isValid: false,
        invalidReason: 'unexpected_settle_error',
        details: { error: errorMessage },
      },
    });
  }
});

app.listen(PORT, () => {
  console.log('x402 Facilitator Service (Chainlink CRE)');
  console.log('='.repeat(50));
  console.log(`Listening on http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  GET  /health              - Health check');
  console.log('  GET  /supported           - Supported payment kinds');
  console.log('  POST /verify              - Verify payment (via CRE DON)');
  console.log('  POST /settle              - Settle payment (via CRE DON)');
  console.log('  POST /verify-and-settle   - Combined operation (via CRE DON)');
  console.log('');
  console.log('All operations routed through Chainlink CRE nodes.');
});
