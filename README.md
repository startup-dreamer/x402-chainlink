# x402-chainlink

**HTTP 402 Payment Protocol powered by Chainlink Runtime Environment**

Pay-per-use API monetization with cryptographic payment proofs and decentralized settlement.

```typescript
// Server
app.get('/premium-data', async (req, res) => {
  if (!req.headers['x-payment-response']) {
    return res.status(402).json({ accepts: [requirements] });
  }
  // Verify & settle via Chainlink CRE
  const verified = await verifyPayment(payload);
  if (verified.isValid) {
    return res.json({ data: premiumData });
  }
});

// Client
const payload = await createPaymentPayload(wallet, requirements);
const response = await fetch(url, {
  headers: { 'X-Payment-Response': payload },
});
```

---

## Table of Contents

- [Quick Start](#-quick-start)
- [Production Deployment](#-production-deployment)
  - [Prerequisites](#prerequisites)
  - [Step 1: Deploy X402Facilitator Contract](#step-1-deploy-x402facilitator-contract)
  - [Step 2: Deploy CRE Workflow](#step-2-deploy-cre-workflow)
  - [Step 3: Configure and Test](#step-3-configure-and-test)
- [Zero-Setup Payments (EIP-2612 Permit)](#-zero-setup-payments-eip-2612-permit)
- [Architecture](#-architecture)
- [API Reference](#-api-overview)
- [Security](#-security)
- [Supported Networks](#-supported-networks)

---

## Quick Start

### Installation

```bash
npm install x402-chainlink viem
```

### Run Examples

```bash
# Full simulation test (no real funds needed)
bun scripts/manual-test-simulation.ts

# HTTP integration test
bun scripts/test-express-server.ts
```

---

## Production Deployment

This section covers deploying x402-chainlink to production using Chainlink Runtime Environment (CRE).

### Prerequisites

1. **Install required tools:**

```bash
# Install CRE CLI
curl -sSL https://cre.chain.link/install.sh | bash

# Install Foundry (for contract deployment)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Bun (for TypeScript)
curl -fsSL https://bun.sh/install | bash
```

2. **Create CRE account:**
   - Visit https://cre.chain.link
   - Create account and link wallet
   - Note your workflow owner address

3. **Get testnet tokens:**
   - Base Sepolia ETH: https://faucet.quicknode.com/base/sepolia
   - USDC on Base Sepolia: (mint test tokens or use faucet)

4. **Configure environment:**

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and fill in:
# - DEPLOYER_PRIVATE_KEY
# - CRE_WORKFLOW_OWNER_ADDRESS
# - API keys (optional, for premium RPCs)
```

### Step 1: Deploy X402Facilitator Contract

The X402Facilitator contract handles on-chain settlement. It receives signed reports from KeystoneForwarder and executes token transfers.

```bash
# Install Foundry dependencies
forge install

# Deploy to Base Sepolia (simulation mode with MockForwarder)
forge script scripts/foundry/DeployX402Facilitator.s.sol:DeployX402Facilitator \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv

# For production (KeystoneForwarder), add USE_KEYSTONE=true
USE_KEYSTONE=true forge script scripts/foundry/DeployX402Facilitator.s.sol:DeployX402Facilitator \
  --rpc-url base_sepolia \
  --broadcast \
  --verify \
  -vvvv
```

**Important:** Save the deployed contract address!

```bash
# Verify deployment
FACILITATOR_ADDRESS=0x... forge script scripts/foundry/VerifyDeployment.s.sol:VerifyDeployment \
  --rpc-url base_sepolia \
  -vvvv
```

### Step 2: Deploy CRE Workflow

The CRE workflow handles payment verification and settlement submission.

```bash
# Navigate to workflow directory
cd x402-workflow

# Install dependencies
bun install

# Update config with your facilitator address
# Edit config.staging.json:
{
  "facilitatorAddress": "0xYOUR_DEPLOYED_ADDRESS",
  "chainName": "base-testnet-sepolia"
}

# Login to CRE
cre login

# Simulate workflow locally (test before deployment)
cre workflow simulate . --target staging-settings \
  --http-payload '{"action":"verify","signature":"0x...","authorization":{...}}'

# Deploy workflow to CRE DON
cre workflow deploy . --target staging-settings
```

**Save the workflow endpoint URL** from the deploy output.

### Step 3: Configure and Test

1. **Update CRE client configuration:**

```typescript
// In your application
import { createCREClient } from 'x402-chainlink';

const creClient = createCREClient({
  endpoint: 'https://cre.chain.link/v1/workflows/YOUR_WORKFLOW_ID/trigger',
  network: 'eip155:84532', // Base Sepolia
  facilitatorAddress: '0xYOUR_FACILITATOR_ADDRESS',
  simulation: false, // Use real CRE workflow
});
```

2. **Token approval options:**

Users can authorize payments in two ways:

**Option A: Traditional Approval (requires on-chain transaction)**

```typescript
// User approves facilitator to spend their USDC
const usdc = getContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  client: walletClient,
});

await usdc.write.approve([
  FACILITATOR_ADDRESS,
  parseUnits('1000', 6), // Approve 1000 USDC
]);
```

**Option B: Zero-Setup with EIP-2612 Permit (no approval transaction needed)**

For supported tokens (USDC, DAI), users can sign a permit that authorizes spending in the same flow as the payment. See [Zero-Setup Payments](#-zero-setup-payments-eip-2612-permit) for details.

3. **Test the full flow:**

```bash
# Run integration test
bun scripts/manual-test-simulation.ts

# Or test with real deployment
bun scripts/test-express-server.ts
```

### Deployment Checklist

- [ ] X402Facilitator deployed and verified
- [ ] CRE workflow deployed and registered
- [ ] Config files updated with addresses
- [ ] Users have approved facilitator OR using permit-enabled tokens
- [ ] End-to-end test passing

---

## Zero-Setup Payments (EIP-2612 Permit)

For tokens that support EIP-2612 (USDC, DAI, and most modern tokens), users can make payments **without any prior approval transaction**. The approval is signed off-chain and executed atomically with the payment.

### How It Works

```
Traditional Flow (2 transactions):
┌──────────┐   1. approve()   ┌──────────┐   2. payment   ┌──────────┐
│   User   ├─────────────────►│  Token   │                │  Server  │
│          │                  │          │◄───────────────┤          │
│          │                  │          │  transferFrom  │          │
└──────────┘                  └──────────┘                └──────────┘

Zero-Setup Flow (0 transactions):
┌──────────┐  sign permit +   ┌──────────┐   permit() +   ┌──────────┐
│   User   │  sign payment    │  Server  │  transferFrom  │  Token   │
│          ├─────────────────►│          ├───────────────►│          │
│          │  (off-chain)     │          │   (atomic)     │          │
└──────────┘                  └──────────┘                └──────────┘
```

### Supported Tokens

| Token | Networks                                                        |
| ----- | --------------------------------------------------------------- |
| USDC  | Ethereum, Base, Arbitrum, Optimism, Polygon (mainnet & testnet) |
| DAI   | Ethereum mainnet                                                |

Check support programmatically:

```typescript
import { checkPermitSupport } from 'x402-chainlink';

const supportsPermit = checkPermitSupport(
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
  8453 // Chain ID
);
console.log(supportsPermit); // true
```

### Client-Side Usage

```typescript
import {
  createPaymentPayloadWithPermit,
  checkPermitSupport,
} from 'x402-chainlink';

// Check if token supports permit
const tokenAddress = paymentRequirements.asset;
const chainId = 8453; // Base

if (checkPermitSupport(tokenAddress, chainId)) {
  // Create payment with permit - no prior approval needed!
  const payload = await createPaymentPayloadWithPermit(
    walletClient,
    publicClient,
    2, // x402 version
    paymentRequirements,
    creConfig,
    {
      includePermit: true,
      facilitatorAddress: '0x...', // X402Facilitator address
    }
  );

  // The payload now includes the permit signature
  // Server will execute permit + transferFrom atomically
} else {
  // Fallback to traditional flow (requires prior approval)
  const payload = await createPaymentPayload(
    walletClient,
    2,
    paymentRequirements,
    creConfig
  );
}
```

### How Permit Works Under the Hood

1. **Client signs two messages** (both off-chain, no gas):
   - EIP-712 Payment Authorization (x402 payment)
   - EIP-2612 Permit (token approval)

2. **Server receives both signatures** and submits to CRE workflow

3. **X402Facilitator contract**:
   - Calls `permit()` on the token contract
   - Immediately calls `transferFrom()`
   - Both happen in the same transaction

4. **Front-running protection**: If the permit fails (e.g., front-run by another tx), the contract checks if sufficient allowance already exists and continues

### Permit Security

The EIP-2612 permit includes:

- **Deadline**: Permit expires after a set time
- **Nonce**: Replay protection (managed by token contract)
- **Domain separation**: Signature is chain and token specific

```solidity
// In X402Facilitator.sol
function _executePermitIfNeeded(...) internal {
    try IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s) {
        // Permit succeeded
    } catch {
        // Permit failed - check if allowance exists
        if (IERC20(token).allowance(owner, spender) >= value) {
            // Continue with existing allowance
        } else {
            revert InsufficientAllowance(...);
        }
    }
}
```

### When to Use Permit

| Scenario                       | Recommendation                                     |
| ------------------------------ | -------------------------------------------------- |
| User's first payment           | Use permit (no setup needed)                       |
| High-value repeated payments   | Consider traditional approval for unlimited amount |
| Unsupported token (USDT, etc.) | Must use traditional approval                      |
| Maximum UX simplicity          | Always try permit first                            |

---

## Architecture

```
┌─────────┐     402 Response      ┌─────────┐
│  Client ├──────────────────────►│  Server │
│         │◄──────────────────────┤         │
│         │  PaymentRequirements  │         │
│         │                       │         │
│ Signs   │  Request + Signature  │         │
│ EIP-712 ├──────────────────────►│         │
│         │                       │         │
└─────────┘                       └────┬────┘
                                       │
                                       │ HTTP Trigger
                                       ▼
                               ┌───────────────┐
                               │  CRE Workflow │
                               │               │
                               │ 1. Verify sig │
                               │ 2. EVM Read   │
                               │    (balance)  │
                               │ 3. EVM Write  │
                               │    (report)   │
                               └───────┬───────┘
                                       │
                                       │ Signed Report
                                       ▼
                          ┌─────────────────────────┐
                          │  KeystoneForwarder      │
                          │  (Chainlink Contract)   │
                          └───────────┬─────────────┘
                                      │
                                      │ onReport(metadata, report)
                                      ▼
                          ┌─────────────────────────┐
                          │  X402Facilitator        │
                          │  (Our Contract)         │
                          │                         │
                          │  Decodes report:        │
                          │  - from, to, amount     │
                          │  - token, nonce         │
                          │  - signature            │
                          │  - permit (optional)    │
                          │                         │
                          │  1. Executes permit()   │
                          │     (if provided)       │
                          │  2. Executes transferFrom│
                          └───────────┬─────────────┘
                                      │
                                      ▼
                          ┌─────────────────────────┐
                          │  ERC-20 Token           │
                          │  (USDC, etc.)           │
                          └─────────────────────────┘
```

### Components

| Component             | Description                                 |
| --------------------- | ------------------------------------------- |
| **Client Library**    | Signs EIP-712 payment authorizations (viem) |
| **Server Middleware** | Express middleware for 402 flow             |
| **CRE Workflow**      | Verifies payments and submits settlements   |
| **X402Facilitator**   | Smart contract for on-chain settlement      |
| **KeystoneForwarder** | Chainlink contract that forwards reports    |

---

## Project Structure

```
x402-starknet/
├── contracts/                    # Solidity smart contracts
│   ├── X402Facilitator.sol      # Main settlement contract
│   ├── interfaces/
│   │   └── IReceiver.sol        # Chainlink IReceiver interface
│   └── test/
│       └── X402Facilitator.t.sol # Foundry tests
├── x402-workflow/                # CRE workflow
│   ├── main.ts                  # Workflow entry point
│   ├── abi/                     # Contract ABIs
│   ├── workflow.yaml            # Workflow configuration
│   ├── config.staging.json      # Testnet config
│   └── config.production.json   # Mainnet config
├── src/                          # TypeScript library
│   ├── cre/                     # CRE client integration
│   ├── payment/                 # Payment verification
│   └── types/                   # Type definitions
├── scripts/                      # Test and deployment scripts
│   └── foundry/                 # Foundry deployment scripts
├── project.yaml                  # CRE project configuration
├── foundry.toml                  # Foundry configuration
└── package.json                  # Node dependencies
```

---

## What is x402-chainlink?

**x402-chainlink** enables true micropayments for HTTP APIs by combining:

1. **HTTP 402 Protocol** - Standard "Payment Required" status code
2. **EIP-712 Signatures** - Gas-free payment authorization
3. **Chainlink CRE** - Decentralized verification & settlement
4. **Multi-chain Support** - Works across any EVM blockchain

### The Problem

Traditional API monetization sucks:

- Minimum transaction amounts ($0.50+ with Stripe)
- High fees (2-3% + fixed costs)
- Subscription lock-in (pay for 1000 calls, use 5)
- Complex OAuth flows
- Centralized payment processors

### The Solution

**Benefits:**

- Micropayments as low as $0.0001
- No user accounts or authentication
- Cryptographic payment proofs (EIP-712)
- Decentralized verification (Chainlink DON)
- Multi-chain settlement
- Pay only for what you use

---

## Use Cases

### 1. AI API Monetization

Pay per token instead of monthly subscriptions

```typescript
buildPaymentRequirements({
  amount: calculateCost(tokenCount),
  asset: 'USDC',
});
```

### 2. Data Marketplace

Buy single datasets without subscriptions

```typescript
buildPaymentRequirements({
  amount: 500000, // $0.50
  resource: 'ipfs://QmXyz.../dataset',
});
```

### 3. Decentralized CDN

Pay per GB bandwidth

```typescript
buildPaymentRequirements({
  amount: calculateBandwidthCost(bytes),
  asset: 'ETH',
});
```

### 4. IoT Micropayments

$0.001 per sensor reading at scale

```typescript
buildPaymentRequirements({
  amount: 1000, // $0.001
  asset: 'USDC',
});
```

---

## API Overview

### Server Side

```typescript
import {
  buildPaymentRequirements,
  verifyPayment,
  settlePayment,
} from 'x402-chainlink';

// Create payment requirements
const requirements = buildPaymentRequirements({
  network: 'eip155:8453', // Base
  amount: 1000000, // 1 USDC
  asset: 'USDC',
  payTo: '0xYourAddress',
  maxTimeoutSeconds: 300,
});

// Return 402
res.status(402).json({
  x402Version: 2,
  accepts: [requirements],
});

// Verify payment
const verification = await verifyPayment(publicClient, payload, requirements);

// Settle payment
const settlement = await settlePayment(publicClient, payload, requirements, {
  creConfig: CRE_CONFIG,
});
```

### Client Side

```typescript
import { createPaymentPayload } from 'x402-chainlink';
import { createWalletClient } from 'viem';

// Sign payment (EIP-712, 0 gas)
const payload = await createPaymentPayload(
  walletClient,
  2, // x402 version
  requirements,
  {
    endpoint: 'https://cre.chainlink.network',
    network: 'eip155:8453',
  }
);

// Send with payment
const response = await fetch(url, {
  headers: {
    'X-Payment-Response': Buffer.from(JSON.stringify(payload)).toString(
      'base64'
    ),
  },
});
```

---

## Security

**Multiple layers of protection:**

1. **EIP-712 Signatures** - Cryptographic payment authorization
   - Prevents tampering
   - Domain-bound (no phishing)
   - Standard wallet support

2. **Nonce Management** - Prevents replay attacks
   - Unique per payment
   - Tracked on-chain in X402Facilitator

3. **Time-Based Expiry** - Prevents stale payments
   - `validUntil` timestamp
   - Configurable timeout

4. **Amount Validation** - Prevents underpayment
   - Strict equality checks
   - No rounding errors

5. **Balance & Allowance Checks** - Prevents insufficient funds
   - Verified via CRE EVM Read capability
   - Before settlement

6. **Decentralized Consensus** - Prevents single-node manipulation
   - Multiple Chainlink DON nodes
   - Byzantine fault tolerance
   - Threshold signatures

7. **On-Chain Verification** - Final security layer
   - X402Facilitator verifies signature
   - Chain ID validation
   - Nonce uniqueness enforced

---

## Supported Networks

| Network          | Chain ID          | Environment |
| ---------------- | ----------------- | ----------- |
| Ethereum         | `eip155:1`        | Mainnet     |
| Base             | `eip155:8453`     | Mainnet     |
| Polygon          | `eip155:137`      | Mainnet     |
| Arbitrum         | `eip155:42161`    | Mainnet     |
| Sepolia          | `eip155:11155111` | Testnet     |
| Base Sepolia     | `eip155:84532`    | Testnet     |
| Arbitrum Sepolia | `eip155:421614`   | Testnet     |

**Supported Tokens:**

- ETH (native)
- USDC
- LINK

**Forwarder Addresses:**

| Network          | MockForwarder                                | KeystoneForwarder                            |
| ---------------- | -------------------------------------------- | -------------------------------------------- |
| Base Sepolia     | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` | `0x1a1c2103A4BCb04F548e9525D4cc33Ac47f1Ec44` |
| Ethereum Sepolia | `0x15fC6ae953E024d975e77382eEeC56A9101f9F88` | `0xF8344CFd5c43616a4366C34E3EEE75af79a74482` |

---

## Comparison

### vs. Stripe

| Feature       | x402-chainlink | Stripe       |
| ------------- | -------------- | ------------ |
| Minimum       | $0.0001        | $0.50        |
| Fee           | ~$0.01 gas     | 2.9% + $0.30 |
| Settlement    | 1-2 min        | 2-7 days     |
| Chargebacks   | None           | Common       |
| Decentralized | Yes            | No           |

### vs. API Keys

| Feature             | x402-chainlink | API Keys    |
| ------------------- | -------------- | ----------- |
| Payment Enforcement | Cryptographic  | Trust-based |
| Metering            | Built-in       | Custom      |
| Billing             | Per-request    | Monthly     |
| User DB             | None           | Required    |

---

## Testing

```bash
# Full simulation (recommended)
bun scripts/manual-test-simulation.ts

# HTTP integration
bun scripts/test-express-server.ts

# Smart contract tests
forge test -vvv

# Real network (needs USDC on Base Sepolia)
bun scripts/manual-test.ts
```

**Test Results:**

```
 Payment Requirements: Created
 EIP-712 Signing: Working
 Signature Format: Valid
 Verification: Passed
 CRE Settlement: Confirmed
 HTTP Integration: Working
```

---

## Development

```bash
# Install dependencies
bun install

# Install Foundry dependencies
forge install

# Build TypeScript
bun run build

# Build contracts
forge build

# Run tests
bun run test
forge test

# Run manual tests
bun scripts/manual-test-simulation.ts
```

---

## Documentation

- **[Complete Architecture Guide](./ARCHITECTURE.md)** - Deep dive into how everything works
- **[HTTP 402 Spec](https://httpwg.org/specs/rfc9110.html#status.402)** - Official HTTP status code
- **[EIP-712](https://eips.ethereum.org/EIPS/eip-712)** - Typed structured data hashing
- **[Chainlink CRE](https://docs.chain.link/cre)** - Runtime Environment docs

---

## Contributing

This is a hackathon project demonstrating the migration from Starknet to Chainlink CRE.

**Migration Highlights:**

- From Starknet to EVM chains (Ethereum, Base, Polygon, Arbitrum)
- From SNIP-6 signatures to EIP-712 signatures
- From starknet.js to viem
- From Paymaster to Chainlink CRE
- From single-chain to multi-chain

---

## License

Apache-2.0 License - see [LICENSE](./LICENSE)

---

## Acknowledgments

- **Nethermind** - Original x402 protocol development
- **Chainlink** - CRE platform and oracle infrastructure
- **Viem** - Excellent TypeScript library for EVM interactions

---

## Links

- **GitHub:** [NethermindEth/x402-chainlink](https://github.com/NethermindEth/x402-chainlink)
- **x402 Protocol:** [x402.org](https://x402.org)
- **Chainlink:** [chain.link](https://chain.link)

---

**Built with care for Chainlink Hackathon 2026**

**Making micropayments great again, one HTTP request at a time!**
