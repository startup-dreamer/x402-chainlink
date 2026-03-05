/**
 * Browser-safe x402 payment client utilities.
 *
 * This file only imports from viem (browser-compatible) — no Node.js APIs.
 * It replicates the small subset of x402-chainlink that runs in the browser:
 *   - HTTP header names
 *   - PaymentRequired decoding (base64 → JSON)
 *   - PaymentPayload signing (EIP-712 via viem)
 *   - EIP-2612 permit signing (gasless USDC approval)
 *   - Encoding the signed payload for the PAYMENT-SIGNATURE header
 *   - SettleResponse decoding (base64 → JSON)
 */

import type {
  WalletClient,
  Transport,
  Chain,
  Account,
} from 'viem';

// ── Header constants (mirror x402-chainlink's HTTP_HEADERS) ─────────────────

export const PAYMENT_HEADERS = {
  REQUIRED: 'PAYMENT-REQUIRED',
  SIGNATURE: 'PAYMENT-SIGNATURE',
  RESPONSE: 'PAYMENT-RESPONSE',
} as const;

// ── Types (minimal subset of x402-chainlink types) ──────────────────────────

export interface PaymentRequirements {
  scheme: string;
  network: string;
  amount: string;
  asset: string | null;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    symbol?: string;
    decimals?: number;
    creContract?: string;
  };
}

export interface PaymentRequired {
  x402Version: 2;
  error?: string;
  resource: { url: string; description?: string; mimeType?: string };
  accepts: PaymentRequirements[];
}

export interface SettleResponse {
  success: boolean;
  errorReason?: string;
  transaction: string;
  network: string;
  status?: string;
  workflowId?: string;
}

/** EIP-2612 permit signature data for gasless USDC approval */
export interface PermitData {
  /** Permit deadline (Unix timestamp in seconds as string) */
  deadline: string;
  /** v component of permit signature */
  v: number;
  /** r component of permit signature */
  r: `0x${string}`;
  /** s component of permit signature */
  s: `0x${string}`;
}

export interface PaymentPayload {
  x402Version: 2;
  accepted: PaymentRequirements;
  payload: {
    signature: string;
    authorization: {
      from: string;
      to: string;
      amount: string;
      token: string | null;
      nonce: string;
      validUntil: string;
      chainId: number;
    };
    /** Optional EIP-2612 permit for gasless USDC approval */
    permit?: PermitData;
  };
  typedData?: object;
  creEndpoint?: string;
}

// ── EIP-2612 permit types ─────────────────────────────────────────────────────

const PERMIT_EIP712_TYPES = {
  Permit: [
    { name: 'owner',    type: 'address' },
    { name: 'spender',  type: 'address' },
    { name: 'value',    type: 'uint256' },
    { name: 'nonce',    type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

// ── EIP-712 domain/types for x402-chainlink ──────────────────────────────────

const X402_EIP712_DOMAIN = { name: 'x402-chainlink', version: '1' } as const;

const X402_EIP712_TYPES = {
  PaymentAuthorization: [
    { name: 'from',       type: 'address' },
    { name: 'to',         type: 'address' },
    { name: 'amount',     type: 'uint256' },
    { name: 'token',      type: 'address' },
    { name: 'nonce',      type: 'uint256' },
    { name: 'validUntil', type: 'uint256' },
    { name: 'chainId',    type: 'uint256' },
  ],
} as const;

// ── CAIP-2 → chain ID ────────────────────────────────────────────────────────

/** Parse a CAIP-2 EVM network identifier into a numeric chain ID. */
export function chainIdFromNetwork(network: string): number {
  const match = /^eip155:(\d+)$/.exec(network);
  if (!match?.[1]) throw new Error(`Unsupported network: ${network}`);
  return parseInt(match[1], 10);
}

// ── Core functions ───────────────────────────────────────────────────────────

/** Decode the PAYMENT-REQUIRED header (base64 → PaymentRequired). */
export function decodePaymentRequired(header: string): PaymentRequired {
  const json = atob(header);
  return JSON.parse(json) as PaymentRequired;
}

/** Encode a signed payment payload as base64 for the PAYMENT-SIGNATURE header. */
export function encodePaymentPayload(payload: PaymentPayload): string {
  const json = JSON.stringify(payload, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
  return btoa(json);
}

/** Decode the PAYMENT-RESPONSE header (base64 → SettleResponse). */
export function decodeSettleResponse(header: string): SettleResponse {
  const json = atob(header);
  return JSON.parse(json) as SettleResponse;
}

/**
 * Sign an EIP-712 payment authorization and create a PaymentPayload.
 *
 * Uses viem's `walletClient.signTypedData` — fully browser-compatible.
 */
export async function signPaymentPayload<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  requirements: PaymentRequirements
): Promise<PaymentPayload> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client must have an account');

  const from = account.address;
  const chainId = chainIdFromNetwork(requirements.network);
  const nonce = Date.now().toString();
  const validUntil = Math.floor(Date.now() / 1000 + requirements.maxTimeoutSeconds).toString();

  const creContract = (requirements.extra?.creContract ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;

  const tokenAddress = (requirements.asset ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;

  const domain = {
    name: X402_EIP712_DOMAIN.name,
    version: X402_EIP712_DOMAIN.version,
    chainId,
    verifyingContract: creContract,
  };

  const message = {
    from: from as `0x${string}`,
    to: requirements.payTo as `0x${string}`,
    amount: BigInt(requirements.amount),
    token: tokenAddress,
    nonce: BigInt(nonce),
    validUntil: BigInt(validUntil),
    chainId: BigInt(chainId),
  };

  const signature = await walletClient.signTypedData({
    account,
    domain,
    types: X402_EIP712_TYPES,
    primaryType: 'PaymentAuthorization',
    message,
  });

  return {
    x402Version: 2,
    accepted: requirements,
    payload: {
      signature,
      authorization: {
        from,
        to: requirements.payTo,
        amount: requirements.amount,
        token: requirements.asset,
        nonce,
        validUntil,
        chainId,
      },
    },
    typedData: { domain, types: X402_EIP712_TYPES, primaryType: 'PaymentAuthorization', message: { from, to: requirements.payTo, amount: requirements.amount, token: tokenAddress, nonce, validUntil, chainId } },
    creEndpoint: 'cli://simulation',
  };
}

/**
 * Sign an EIP-2612 permit for gasless USDC approval.
 *
 * This lets the X402Facilitator call `permit()` + `transferFrom()` atomically
 * without the payer needing ETH for a separate `approve()` transaction.
 *
 * @param walletClient - Viem wallet client with an account
 * @param tokenAddress - ERC-20 token contract (must support EIP-2612)
 * @param tokenName - Token's EIP-712 domain name (e.g. "USDC")
 * @param tokenVersion - Token's EIP-712 domain version (e.g. "2" for USDC)
 * @param spenderAddress - Address to approve (X402Facilitator)
 * @param amount - Amount to approve (as string, in token's smallest unit)
 * @param chainId - Chain ID
 * @param nonce - Current permit nonce from the token contract
 * @param deadlineSeconds - Unix timestamp for permit expiry
 */
export async function signPermit<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  tokenAddress: `0x${string}`,
  tokenName: string,
  tokenVersion: string,
  spenderAddress: `0x${string}`,
  amount: string,
  chainId: number,
  nonce: bigint,
  deadlineSeconds: number,
): Promise<PermitData> {
  const account = walletClient.account;
  if (!account) throw new Error('Wallet client must have an account');

  const deadline = BigInt(deadlineSeconds);

  const domain = {
    name: tokenName,
    version: tokenVersion,
    chainId,
    verifyingContract: tokenAddress,
  };

  const message = {
    owner: account.address as `0x${string}`,
    spender: spenderAddress,
    value: BigInt(amount),
    nonce,
    deadline,
  };

  const sig = await walletClient.signTypedData({
    account,
    domain,
    types: PERMIT_EIP712_TYPES,
    primaryType: 'Permit',
    message,
  });

  // Split 65-byte compact signature into (r, s, v)
  const r = sig.slice(0, 66) as `0x${string}`;
  const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(sig.slice(130, 132), 16);

  return { deadline: deadline.toString(), v, r, s };
}
