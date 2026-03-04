<div style="text-align:center" align="center">
    <a href="https://chain.link" target="_blank">
        <img src="./assets/logo.png" width="255" alt="Chainlink logo">
    </a>

![npm downloads](https://img.shields.io/npm/dt/x402-chainlink?style=flat&label=npm%20downloads&color=green)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](https://www.apache.org/licenses/LICENSE-2.0)
[![Chainlink Runtime Environment Documentation](https://img.shields.io/static/v1?label=cre-docs&message=latest&color=yellow)](https://docs.chain.link/cre)

[![sdk-docs](https://img.shields.io/static/v1?label=sdk-docs&message=latest&color=yellow)](https://startup-dreamer.github.io/x402-chainlink/)

</div>

## Preface

Monetizing Web3 APIs today means either building a centralized database to track user deposits, or forcing users to sign clunky, expensive transactions for every API call.

**x402-Chainlink solves this.** Instead of a centralized processor acting as the middleman, we use **Chainlink CRE** as a verifiable, decentralized backend. The x402 protocol handles the HTTP-level negotiation, allowing servers to demand payment and clients to automatically fulfill it via smart contracts, returning a cryptographically secure token (like a [Macaroon](https://research.google/pubs/pub41892/)) to access the resource.

# x402-chainlink

## Overview

x402-chainlink is a self-sovereign payment SDK that acts as the "Stripe for Web3." It enables developers to seamlessly monetize APIs, digital resources, and AI agent workflows using standard HTTP 402 (Payment Required) protocols, entirely secured by the Chainlink Runtime Environment (CRE).

Unlike centralized payment processors or clunky escrow contracts, x402 allows users to maintain absolute custody of their funds. Buyers simply sign an off-chain intent to pay, and the Chainlink Decentralized Oracle Network (DON) handles the rest—verifying balances and executing trustless, atomic settlements on-chain.


**Key Features**

* **Machine-to-Machine (M2M) Payments:** Designed natively for the agentic economy. AI agents and headless clients can seamlessly intercept 402 responses, request cryptographic signatures, and pay for the resources they consume autonomously.
* **Universal API & dApp Gating:** Standardized HTTP headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`) provide a drop-in solution to gate premium API endpoints, exclusive dApp features, or digital downloads without building complex, centralized paywalls.
* **Extensible Architecture (Custom Modules):** The SDK ships with a built-in `ExtensionRegistry` featuring strict JSON schema validation. Developers can easily extend the base protocol to build custom Web3 billing models like **metered usage**, **recurring subscriptions**, **tipping**, or receipt generation.
* **True Self-Sovereignty (EIP-712):** No centralized deposits or hot wallets. Users hold their keys and authorize payments via secure, off-chain cryptographic signatures.
* **Gasless User Experience (EIP-2612):** Built-in support for token permits eliminates the friction of separate, expensive "Approve" and "Transfer" transactions. Users experience a one-click checkout.
* **Unstoppable Settlement:** Chainlink DONs provide Byzantine Fault Tolerant (BFT) consensus to verify signatures and settle the final token transfers trustlessly via the `X402Facilitator` smart contract.

---

## Table of contents

- [Push Engine](#push-engine)
  - [Overview](#overview)
    - [Key Features:](#key-features)
  - [Table of contents](#table-of-contents)
  - [System Architecture Overview](#system-architecture-overview)
  - [Installation Instructions](#installation-instructions)
    - [Prerequisites](#prerequisites)
    - [Installation Steps](#installation-steps)
  - [Environment Variables](#environment-variables)
  - [YAML Configuration Setup](#yaml-configuration-setup)
    - [YAML Configuration](#yaml-configuration)
    - [Example YAML Configuration](#example-yaml-configuration)
    - [Key Configuration Parameters](#key-configuration-parameters)
  - [Deployment Guide](#deployment-guide)
    - [Running with Docker Compose](#running-with-docker-compose)
    - [Production Deployment](#production-deployment)
  - [WebSocket Reconnect Logic](#websocket-reconnect-logic)
    - [How it works](#how-it-works)
    - [When Reconnect Happens](#when-reconnect-happens)
    - [Reconnect Configuration](#reconnect-configuration)
    - [Retry Logic](#retry-logic)
  - [Infrastructural Considerations](#infrastructural-considerations)
  - [UI](#ui)
    - [UI Setup Instructions](#ui-setup-instructions)
    - [UI usage](#ui-usage)
      - [Streams](#streams)
        - [Contract](#contract)
          - [EVM Contract](#evm-contract)
          - [SVM Program](#svm-program)
        - [Add new data stream](#add-new-data-stream)
      - [Chain](#chain)
        - [Switch chain](#switch-chain)
        - [Add new chain](#add-new-chain)
      - [Schedule](#schedule)
        - [Set new schedule pattern](#set-new-schedule-pattern)
      - [Verifier Contracts](#verifier-contracts)
        - [Set Verifier Contracts](#set-verifier-contracts)
      - [Price delta percentage](#price-delta-percentage)
      - [Gas cap](#gas-cap)
      - [Logs](#logs)
  - [Logging](#logging)
  - [Testing Commands](#testing-commands)
  - [Notes](#notes)
  - [Troubleshooting](#troubleshooting)
    - [Common Issues \& Fixes](#common-issues--fixes)
  - [Modifications \& Further Development](#modifications--further-development)
    - [Modifications](#modifications)
  - [Styling](#styling)
  - [License](#license)
  - [Resources](#resources)
# 🌐 x402-Chainlink SDK: The Web3 Stripe Powered by CRE

x402-Chainlink is a robust, developer-friendly SDK that brings a "Stripe-like" seamless payment experience to Web3. By leveraging the **x402 Protocol** (an evolution of the HTTP 402 Payment Required standard) and the **Chainlink Runtime Environment (CRE)**, this project enables developers to instantly monetize APIs, content, and services with decentralized, chain-agnostic micro-payments.

If you can use a standard REST API, you can now monetize it with crypto in less than 10 lines of code.

---

## 💡 The Vision: Decentralizing the Payment Processor

Centralized payment processors like Stripe revolutionized Web2 by abstracting away the complexity of fiat banking. However, Web3 payments remain fragmented, requiring users to sign complex transactions, manage multiple wallets, and deal with network-specific RPCs just to access a simple paid API or premium article.

**x402-Chainlink solves this.** Instead of a centralized processor acting as the middleman, we use **Chainlink CRE** as a verifiable, decentralized backend. The x402 protocol handles the HTTP-level negotiation, allowing servers to demand payment and clients to automatically fulfill it via smart contracts, returning a cryptographically secure token (like a Macaroon) to access the resource.

### 🎯 Key Use Cases

1. **API Monetization (Machine-to-Machine):** Charge per API call without requiring users to buy subscriptions. Perfect for AI models, oracle data feeds, or heavy compute tasks.
2. **Decentralized Paywalls:** Monetize premium content, articles, or digital media natively via user wallets.
3. **Frictionless Token-Gating:** Verify NFT or token holdings directly at the HTTP layer before serving content.
4. **Automated Micro-transactions:** Enable streaming payments for continuous services (e.g., video streaming, cloud storage).

---

## 🏗️ Architecture & Protocol Flow

The SDK abstracts the entire x402 negotiation and on-chain settlement process. Under the hood, Chainlink CRE acts as the secure, decentralized verifier that confirms the payment on-chain and signs the authorization token.

### System Architecture

```mermaid
graph TD
    subgraph Client Application
        C[Client / Browser]
        S[x402 SDK Client]
    end

    subgraph Server Infrastructure
        API[Your REST API]
        M[x402 Middleware]
    end

    subgraph Decentralized Verification
        CRE[Chainlink Runtime Environment]
        SC[Smart Contracts / EVM]
    end

    C <-->|1. HTTP Request| API
    API <-->|2. Returns 402 + Invoice| M
    S -->|3. Initiates Payment| SC
    CRE -->|4. Observes & Verifies| SC
    CRE -->|5. Issues Pre-image/Proof| S
    S -->|6. Retry Request + Proof| API

```

### The x402 Negotiation Sequence

```mermaid
sequenceDiagram
    autonumber
    participant User as Client (x402 SDK)
    participant Server as Resource Server
    participant CRE as Chainlink CRE
    participant Blockchain as Smart Contract

    User->>Server: GET /api/premium-data
    Server-->>User: HTTP 402 Payment Required <br/> (Headers: Payment-Req, Network, Amount)
    
    Note over User,Blockchain: Payment Phase
    User->>Blockchain: Transfer Funds (ERC20 / Native)
    
    Note over CRE,Blockchain: Verification Phase
    CRE->>Blockchain: Listen for payment event
    Blockchain-->>CRE: Event Confirmed
    CRE->>CRE: Generate cryptographic proof (Macaroon/Signature)
    CRE-->>User: Return Proof
    
    Note over User,Server: Fulfillment Phase
    User->>Server: GET /api/premium-data <br/> (Header: Authorization: L402 <Proof>)
    Server->>Server: Validate Proof (Local or via CRE)
    Server-->>User: HTTP 200 OK (Delivers Data)

```

---

## 🚀 Built for the Masses: SDK Usage

We built this SDK to be as intuitive as Web2 payment gateways. You don't need to be a blockchain expert to use it.

### 1. Server-Side: Protecting an Endpoint

Wrap your existing Express, Next.js, or standard Node.js endpoints with our middleware.

```typescript
import express from 'express';
import { x402Middleware } from 'x402-chainlink/server';

const app = express();

// Initialize the middleware with your Chainlink CRE config
const requirePayment = x402Middleware({
  creEndpoint: process.env.CRE_ENDPOINT,
  acceptedTokens: ['USDC', 'LINK'],
  price: 0.50, // USD
  network: 'any-evm' // Chain-agnostic via Chainlink CCIP/CRE
});

// Protect the route
app.get('/api/generate-ai-image', requirePayment, (req, res) => {
  res.json({ image: "https://...", message: "Payment successful via CRE!" });
});

app.listen(3000);

```

### 2. Client-Side: Consuming a Paid Endpoint

The client SDK intercepts `402 Payment Required` responses, automatically prompts the user's wallet for payment, retrieves the proof from the Chainlink CRE, and retries the request seamlessly.

```typescript
import { X402Client } from 'x402-chainlink/client';

// Initialize the client (hooks into Ethers.js, Viem, or Solana Web3)
const client = new X402Client({
  provider: window.ethereum, 
  autoPay: true, // Automatically handle micro-transactions below a certain threshold
  maxAutoPayThreshold: 5.00 
});

async function fetchPremiumData() {
  try {
    // The client handles the entire 402 negotiation under the hood
    const response = await client.fetch('https://api.yoursite.com/api/generate-ai-image');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Payment failed or request aborted", error);
  }
}

```

---

## 🛠️ Why Chainlink CRE?

The core innovation of this project lies in moving the heavy lifting of payment verification off the primary application server and into the **Chainlink Runtime Environment**.

* **Absolute Trust:** The server doesn't need to trust the client, and the client doesn't need to trust the server. The CRE acts as the decentralized, unbiased referee that verifies the on-chain settlement and issues the access credential.
* **Chain Agnosticism:** Because CRE can observe multiple networks, your API can accept payments on Polygon, Base, Ethereum, or Arbitrum simultaneously without you having to run local RPC nodes for each.
* **Low Latency:** CRE workflows execute securely and rapidly off-chain, ensuring the HTTP request-response cycle remains fast enough for modern web applications.

## 🏁 Running Locally

1. **Clone & Install:**
```bash
git clone https://github.com/your-org/x402-chainlink.git
cd x402-chainlink
npm install

```


2. **Configure Environment:**
Copy `.env.example` to `.env` and add your Chainlink CRE credentials and target RPC URLs.
3. **Deploy the Verifier Contract:**
```bash
npm run deploy:contracts

```


4. **Run the Example App:**
```bash
npm run dev:example

```



## 🤝 Contributing & Next Steps

This project is open-source and actively seeking contributions. Future roadmap items include:

* Full native Solana program integration.
* Subscription/recurring payment models using Chainlink Automation.
* Native browser extension for background x402 automated settlements.

---

*Empowering the next generation of the decentralized web with seamless, borderless micro-monetization.*




Here is the revised Overview section. It keeps the core technical reality of the SDK intact (HTTP 402, EIP-712, Chainlink CRE settlement) but completely reframes the narrative around the massive potential of the Machine-to-Machine (M2M) economy and autonomous AI agents.

---

### Overview

**x402-chainlink** is a self-sovereign, machine-to-machine (M2M) payment SDK designed specifically for the Agentic Economy. It enables autonomous AI Agents to trustlessly pay for premium APIs, private data, and complex computations using crypto, with settlement entirely secured by the Chainlink Runtime Environment (CRE).

Unlike humans, AI agents cannot "click a button" to connect a browser wallet or pass a CAPTCHA to pay for a service. They require a programmatic negotiation layer. Furthermore, standard fiat rails cannot support the $0.05 micro-payments required for high-frequency AI API consumption, and pre-funding centralized developer accounts forces users to give up custody of their funds.

This SDK solves this by standardizing the **HTTP 402 (Payment Required)** flow for AI frameworks (like LangChain or AutoGPT). When an AI agent hits a paywall, it receives a machine-readable price quote. It checks its local budget, cryptographically signs an off-chain intent to pay, and retries the request. The Chainlink Decentralized Oracle Network (DON) intercepts the signature, verifies it, and executes a trustless, atomic settlement on-chain before the data is served.

**Core Features**

* **Autonomous Pay-As-You-Go:** No centralized escrow or pre-paid credits. Agents maintain absolute custody of their EVM private keys and pay precisely per API call.
* **Programmatic Negotiation:** Standardized `PAYMENT-REQUIRED` and `PAYMENT-SIGNATURE` HTTP headers allow any AI agent to natively "understand" paywalls and resolve them automatically.
* **Viable Micro-Payments:** Built-in gasless token permits (EIP-2612) combined with Layer 2 networks make tiny, fractional payments economically feasible for agentic workflows.
* **Unstoppable Settlement:** Chainlink DONs provide Byzantine Fault Tolerant (BFT) consensus to verify agent signatures and settle the final token transfers trustlessly via the `X402Facilitator` contract.