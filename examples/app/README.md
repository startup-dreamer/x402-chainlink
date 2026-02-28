# Chainlink x402 Demo

A demonstration of the **x402 payment protocol** on EVM chains using USDC micropayments on Base Sepolia, with settlement via **Chainlink CRE**.

## Overview

This starter kit shows how to protect API endpoints with on-chain micropayments. Clients pay a small amount of USDC per request; the payment is verified and settled through the Chainlink Runtime Environment (CRE).

### Payment Flow

```
Client                         Server (API Route)              CRE Simulation
  │                                  │                               │
  ├──GET /api/protected/weather──────►│                               │
  │◄──────────────────────────402────┤ (PAYMENT-REQUIRED header)     │
  │                                  │                               │
  │  [sign EIP-712 with viem]         │                               │
  │                                  │                               │
  ├──GET /api/protected/weather──────►│                               │
  │  (PAYMENT-SIGNATURE header)       │                               │
  │                            verifyPayment()                        │
  │                                  │◄────────isValid: true─────────│
  │◄──────────────────────────200────┤ (weather data)                │
  │                            settlePayment()──────────────────────►│
  │                                  │◄────txHash (Base Sepolia)─────│
  │  PAYMENT-RESPONSE header         │                               │
```

### Features

- **Automated agent**: `WeatherClient` handles the full 402 flow — no manual payment steps
- **EIP-712 signing**: Gas-free payment authorization with viem
- **Protected routes**: Server-side verification + settlement in Next.js API routes
- **CRE simulation**: Run the Chainlink workflow locally, optionally broadcast real transactions
- **Base Sepolia**: Testnet USDC micropayments (0.001 USDC per request)

---

## Getting Started

### Prerequisites

- Node.js 18+
- Two wallets on **Base Sepolia**:
  - **Sender wallet**: needs USDC on Base Sepolia
  - **Receiver wallet**: receives USDC payments
- The `x402-chainlink` SDK (sibling directory, built)

### 1. Build the SDK

```bash
cd ../x402-chainlink
bun run build
cd ../chainlink-x402-starter-kit
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SENDER_PRIVATE_KEY=0x...your_testnet_private_key
RECEIVER_ADDRESS=0x...your_receiver_address
```

> **Security**: `NEXT_PUBLIC_SENDER_PRIVATE_KEY` is exposed to the browser (intentional for demo). Use a testnet-only wallet with minimal funds.

### 4. Get testnet USDC

Get USDC on Base Sepolia from the [Circle Faucet](https://faucet.circle.com/) for the sender wallet.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **FETCH DATA**.

---

## How It Works

### Without CRE CLI (default demo mode)

When you click FETCH DATA:

1. Client requests `/api/protected/weather` — gets 402
2. Client signs an EIP-712 payment authorization with the sender's private key
3. Client retries with the `PAYMENT-SIGNATURE` header
4. Server verifies the signature, balance, and allowance locally
5. Server returns weather data
6. Server attempts CRE settlement — if `cre` CLI is not installed, logs a warning and continues

The UI shows **PAYMENT VERIFIED** with a note that settlement was simulated.

### With CRE CLI (simulation + broadcast mode)

This mode runs the actual CRE workflow locally and optionally broadcasts a real transaction.

**Prerequisites:**
1. Install the Chainlink CRE CLI: [docs.chain.link/cre](https://docs.chain.link/cre)
2. Deploy `X402Facilitator.sol` from `../x402-chainlink/contracts/src/`:
   ```bash
   cd ../x402-chainlink/contracts
   forge script script/DeployX402Facilitator.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
   ```
3. Update `.env.local`:
   ```env
   FACILITATOR_ADDRESS=0x...deployed_facilitator_address
   WORKFLOW_PATH=../x402-chainlink/x402-workflow
   CRE_TARGET=staging-settings
   CRE_BROADCAST=true
   ```

With `CRE_BROADCAST=true`, the settlement runs:
```
cre workflow simulate ../x402-chainlink/x402-workflow \
  --target staging-settings \
  --broadcast \
  --trigger-index 0 \
  --http-payload <payment_json>
```

This submits a **real transaction** to Base Sepolia via the X402Facilitator contract. The transaction hash is returned and shown with a link to Basescan.

---

## Project Structure

```
chainlink-x402-starter-kit/
├── app/
│   ├── api/
│   │   └── protected/
│   │       └── weather/
│   │           └── route.ts     # Protected endpoint (Node.js runtime)
│   ├── components/
│   │   ├── WeatherClient.tsx    # Automated payment agent component
│   │   ├── ThemeToggle.tsx
│   │   └── SocialLinks.tsx
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── lib/
│   └── payment-config.ts        # Payment requirements (network, amount, asset)
├── .env.local.example
├── package.json
└── README.md
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SENDER_PRIVATE_KEY` | Yes | Payer private key (testnet only, exposed to browser) |
| `RECEIVER_ADDRESS` | Yes | Wallet that receives USDC payments |
| `FACILITATOR_ADDRESS` | For broadcast | X402Facilitator contract on Base Sepolia |
| `WORKFLOW_PATH` | For CRE | Path to x402-workflow dir (default: `../x402-chainlink/x402-workflow`) |
| `CRE_TARGET` | For CRE | CRE target settings name (default: `staging-settings`) |
| `CRE_BROADCAST` | For real txs | Set `true` to broadcast to Base Sepolia |

---

## Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/)
- **Blockchain**: Base Sepolia (EVM)
- **Payment Protocol**: [x402-chainlink](../x402-chainlink)
- **EVM Client**: [viem](https://viem.sh/)
- **Settlement**: [Chainlink CRE](https://docs.chain.link/cre)
- **Styling**: Tailwind CSS

## License

MIT
