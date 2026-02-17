/**
 * Payment creation functions for EVM with EIP-712 signing
 */

import type {
  WalletClient,
  Transport,
  Chain,
  Account,
  PublicClient,
  HttpTransport,
} from 'viem';
import type {
  PaymentRequirements,
  PaymentPayload,
  PaymentRequirementsSelector,
  PaymentRequired,
  SettleResponse,
  EVMNetworkId,
  CREConfig,
  EIP712TypedData,
  CompactSignature,
  PermitData,
  CreatePaymentWithPermitOptions,
} from '../types/index.js';
import {
  networksEqual,
  getChainId as getChainIdFromNetwork,
} from '../types/index.js';
import { getTokenBalance } from '../utils/token.js';
import { err, PaymentError, NetworkError } from '../errors.js';
import {
  X402_EIP712_DOMAIN,
  X402_EIP712_TYPES,
  PERMIT_EIP712_TYPES,
} from '../types/payment.js';
import { getPermitDomain, isPermitSupported } from '../tokens/index.js';

/**
 * HTTP header names for x402 protocol
 * Spec compliance: x402 v2 - HTTP Transport
 */
export const HTTP_HEADERS = {
  /** Header for 402 response containing payment requirements */
  PAYMENT_REQUIRED: 'PAYMENT-REQUIRED',
  /** Header for client payment signature/payload */
  PAYMENT_SIGNATURE: 'PAYMENT-SIGNATURE',
  /** Header for settlement response after successful payment */
  PAYMENT_RESPONSE: 'PAYMENT-RESPONSE',
} as const;

/**
 * Select appropriate payment requirements from available options
 *
 * @param requirements - Array of payment requirement options
 * @param client - Viem public client
 * @param walletAddress - User's wallet address
 * @param targetNetwork - Target network to match
 * @returns Selected payment requirements
 * @throws Error if no requirements can be satisfied
 */
export async function selectPaymentRequirements(
  requirements: Array<PaymentRequirements>,
  client: PublicClient<HttpTransport, Chain>,
  walletAddress: `0x${string}`,
  targetNetwork: EVMNetworkId
): Promise<PaymentRequirements> {
  if (requirements.length === 0) {
    throw err.invalid('No payment requirements provided');
  }

  const compatibleRequirements = requirements.filter((req) =>
    networksEqual(req.network, targetNetwork)
  );

  if (compatibleRequirements.length === 0) {
    throw NetworkError.networkMismatch(
      targetNetwork,
      requirements.map((r) => r.network).join(', ')
    );
  }

  // Check balances for compatible requirements
  const requirementsWithBalance = await Promise.all(
    compatibleRequirements.map(async (req) => {
      if (!req.asset) {
        return { requirement: req, balance: '0', hasBalance: false };
      }
      try {
        const balance = await getTokenBalance(
          client,
          req.asset as `0x${string}`,
          walletAddress
        );
        const hasBalance = BigInt(balance) >= BigInt(req.amount);
        return { requirement: req, balance, hasBalance };
      } catch {
        return { requirement: req, balance: '0', hasBalance: false };
      }
    })
  );

  const affordableRequirements = requirementsWithBalance.filter(
    (r) => r.hasBalance
  );

  if (affordableRequirements.length === 0) {
    const first = requirementsWithBalance[0];
    if (first) {
      throw PaymentError.insufficientFunds(
        first.requirement.amount,
        first.balance
      );
    }
    throw err.internal('No requirements with balance info');
  }

  // Select the best option: lowest cost that meets timeout constraints
  const sorted = affordableRequirements.sort((a, b) => {
    const amountA = BigInt(a.requirement.amount);
    const amountB = BigInt(b.requirement.amount);
    if (amountA < amountB) return -1;
    if (amountA > amountB) return 1;
    // If amounts are equal, prefer shorter timeout (faster settlement)
    return a.requirement.maxTimeoutSeconds - b.requirement.maxTimeoutSeconds;
  });

  const selected = sorted[0];
  if (!selected) {
    throw err.internal(
      'Unexpected: no affordable requirements after filtering'
    );
  }
  return selected.requirement;
}

/**
 * Custom selector type for payment requirements
 */
export type { PaymentRequirementsSelector };

/**
 * Build EIP-712 typed data for payment authorization
 */
export function buildPaymentTypedData(
  paymentRequirements: PaymentRequirements,
  from: `0x${string}`,
  nonce: string,
  validUntil: string,
  creContract: `0x${string}`
): EIP712TypedData {
  const chainId = getChainIdFromNetwork(paymentRequirements.network);
  const tokenAddress = paymentRequirements.asset as `0x${string}`;

  return {
    domain: {
      name: X402_EIP712_DOMAIN.name,
      version: X402_EIP712_DOMAIN.version,
      chainId,
      verifyingContract: creContract,
    },
    types: {
      PaymentAuthorization: X402_EIP712_TYPES.PaymentAuthorization,
    },
    primaryType: 'PaymentAuthorization',
    message: {
      from,
      to: paymentRequirements.payTo,
      amount: BigInt(paymentRequirements.amount),
      token: tokenAddress,
      nonce: BigInt(nonce),
      validUntil: BigInt(validUntil),
      chainId: BigInt(chainId),
    } as Record<string, unknown>,
  };
}

/**
 * Create payment payload for x402 request
 *
 * @param walletClient - Viem wallet client for signing
 * @param x402Version - x402 protocol version (currently 2)
 * @param paymentRequirements - Payment requirements from server
 * @param creConfig - CRE configuration (endpoint, contract address)
 * @returns Payment payload to send to server
 *
 * @example
 * ```typescript
 * const payload = await createPaymentPayload(
 *   walletClient,
 *   2,
 *   paymentRequirements,
 *   {
 *     endpoint: 'https://cre.chainlink.example.com',
 *     network: 'eip155:8453'
 *   }
 * );
 * ```
 */
export async function createPaymentPayload<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  _x402Version: number, // v2: Always creates v2 payloads, parameter kept for API compatibility
  paymentRequirements: PaymentRequirements,
  creConfig: CREConfig
): Promise<PaymentPayload> {
  const account = walletClient.account;
  if (!account) {
    throw err.invalid('Wallet client must have an account');
  }

  const from = account.address;
  const chainId = getChainIdFromNetwork(paymentRequirements.network);

  // Generate nonce (timestamp-based for simplicity)
  const nonce = Date.now().toString();

  const validUntil = Math.floor(
    Date.now() / 1000 + paymentRequirements.maxTimeoutSeconds
  ).toString();

  const creContract =
    paymentRequirements.extra?.creContract ??
    ('0x0000000000000000000000000000000000000000' as `0x${string}`);

  const typedData = buildPaymentTypedData(
    paymentRequirements,
    from,
    nonce,
    validUntil,
    creContract
  );

  const signature = await walletClient.signTypedData({
    account,
    domain: typedData.domain,
    types: { PaymentAuthorization: X402_EIP712_TYPES.PaymentAuthorization },
    primaryType: 'PaymentAuthorization',
    message: typedData.message,
  });

  const payload: PaymentPayload = {
    x402Version: 2,
    accepted: paymentRequirements,
    payload: {
      signature: signature as CompactSignature,
      authorization: {
        from,
        to: paymentRequirements.payTo,
        amount: paymentRequirements.amount,
        token: paymentRequirements.asset,
        nonce,
        validUntil,
        chainId,
      },
    },
    typedData,
    creEndpoint: creConfig.endpoint,
  };

  return payload;
}

/**
 * Encode payment payload to base64 string for PAYMENT-SIGNATURE header
 *
 * @param payload - Payment payload to encode
 * @returns Base64-encoded string
 */
export function encodePaymentSignature(payload: PaymentPayload): string {
  const json = JSON.stringify(payload, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
  return Buffer.from(json).toString('base64');
}

/**
 * Decode payment payload from base64 PAYMENT-SIGNATURE header
 *
 * @param encoded - Base64-encoded payment signature header
 * @returns Decoded payment payload
 */
export function decodePaymentSignature(encoded: string): PaymentPayload {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment payload: must be an object');
  }

  return parsed as PaymentPayload;
}

/**
 * Encode PaymentRequired to base64 string for PAYMENT-REQUIRED header
 *
 * @param response - Payment required response to encode
 * @returns Base64-encoded string
 */
export function encodePaymentRequired(response: PaymentRequired): string {
  const json = JSON.stringify(response);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode PaymentRequired from base64 PAYMENT-REQUIRED header
 *
 * @param encoded - Base64-encoded payment required header
 * @returns Decoded payment required response
 */
export function decodePaymentRequired(encoded: string): PaymentRequired {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment required: must be an object');
  }

  return parsed as PaymentRequired;
}

/**
 * Encode SettleResponse to base64 string for PAYMENT-RESPONSE header
 *
 * @param response - Settlement response to encode
 * @returns Base64-encoded string
 */
export function encodePaymentResponse(response: SettleResponse): string {
  const json = JSON.stringify(response);
  return Buffer.from(json).toString('base64');
}

/**
 * Decode SettleResponse from base64 PAYMENT-RESPONSE header
 *
 * @param encoded - Base64-encoded payment response header
 * @returns Decoded settlement response
 */
export function decodePaymentResponse(encoded: string): SettleResponse {
  const json = Buffer.from(encoded, 'base64').toString('utf-8');
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw err.invalid('Invalid payment response: must be an object');
  }

  return parsed as SettleResponse;
}

/**
 * Check if a token supports EIP-2612 permit
 *
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID
 * @returns True if the token supports permit
 *
 * @example
 * ```typescript
 * const supportsPermit = checkPermitSupport(
 *   '0xA0b86a00000000000000000000000000000000000000', // USDC
 *   8453 // Base
 * );
 * ```
 */
export function checkPermitSupport(
  tokenAddress: `0x${string}`,
  chainId: number
): boolean {
  return isPermitSupported(tokenAddress, chainId);
}

/**
 * Get token's permit nonce for an owner
 *
 * @param publicClient - Viem public client
 * @param tokenAddress - Token contract address
 * @param ownerAddress - Token owner address
 * @returns Current permit nonce for the owner
 */
export async function getPermitNonce(
  publicClient: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`
): Promise<bigint> {
  try {
    // Call the nonces function on the token contract (EIP-2612)
    const result = await publicClient.readContract({
      address: tokenAddress,
      abi: [
        {
          name: 'nonces',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ],
      functionName: 'nonces',
      args: [ownerAddress],
    });
    return result as bigint;
  } catch {
    throw err.invalid(
      `Token ${tokenAddress} does not support EIP-2612 permit (no nonces function)`
    );
  }
}

/**
 * Create EIP-2612 permit signature
 *
 * @param walletClient - Viem wallet client for signing
 * @param publicClient - Viem public client for reading nonce
 * @param tokenAddress - Token contract address
 * @param spenderAddress - Spender address (X402Facilitator contract)
 * @param amount - Amount to approve
 * @param deadline - Permit deadline (Unix timestamp)
 * @param chainId - Chain ID
 * @returns Permit signature data
 *
 * @example
 * ```typescript
 * const permit = await createPermitSignature(
 *   walletClient,
 *   publicClient,
 *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
 *   '0x1234...', // Facilitator address
 *   1000000n,   // 1 USDC
 *   BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
 *   8453        // Base
 * );
 * ```
 */
export async function createPermitSignature<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  publicClient: PublicClient<HttpTransport, Chain>,
  tokenAddress: `0x${string}`,
  spenderAddress: `0x${string}`,
  amount: bigint,
  deadline: bigint,
  chainId: number
): Promise<PermitData> {
  const account = walletClient.account;
  if (!account) {
    throw err.invalid('Wallet client must have an account');
  }

  const owner = account.address;

  const domain = getPermitDomain(tokenAddress, chainId);
  if (!domain) {
    throw err.invalid(
      `Token ${tokenAddress} on chain ${chainId} does not support EIP-2612 permit`
    );
  }

  const nonce = await getPermitNonce(publicClient, tokenAddress, owner);

  const message = {
    owner,
    spender: spenderAddress,
    value: amount,
    nonce,
    deadline,
  };

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: domain.name,
      version: domain.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
    },
    types: { Permit: PERMIT_EIP712_TYPES.Permit },
    primaryType: 'Permit',
    message,
  });

  const { v, r, s } = parseSignature(signature);

  return {
    deadline: deadline.toString(),
    v,
    r,
    s,
  };
}

/**
 * Parse a compact signature into v, r, s components
 */
function parseSignature(signature: `0x${string}`): {
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
} {
  const sig = signature.slice(2);

  // Extract r, s, v
  const r = `0x${sig.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sig.slice(64, 128)}` as `0x${string}`;
  let v = parseInt(sig.slice(128, 130), 16);

  // Normalize v (some signers return 0/1 instead of 27/28)
  if (v < 27) {
    v += 27;
  }

  return { v, r, s };
}

/**
 * Create payment payload with optional EIP-2612 permit
 *
 * @param walletClient - Viem wallet client for signing
 * @param publicClient - Viem public client for reading nonce
 * @param x402Version - x402 protocol version (currently 2)
 * @param paymentRequirements - Payment requirements from server
 * @param creConfig - CRE configuration (endpoint, contract address)
 * @param options - Optional permit configuration
 * @returns Payment payload with permit data (if supported)
 *
 * @example
 * ```typescript
 * const payload = await createPaymentPayloadWithPermit(
 *   walletClient,
 *   publicClient,
 *   2,
 *   paymentRequirements,
 *   { endpoint: 'https://cre.chainlink.example.com', network: 'eip155:8453' },
 *   {
 *     includePermit: true,
 *     facilitatorAddress: '0x1234...'
 *   }
 * );
 * ```
 */
export async function createPaymentPayloadWithPermit<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  publicClient: PublicClient<HttpTransport, Chain>,
  _x402Version: number,
  paymentRequirements: PaymentRequirements,
  creConfig: CREConfig,
  options?: CreatePaymentWithPermitOptions
): Promise<PaymentPayload> {
  const payload = await createPaymentPayload(
    walletClient,
    _x402Version,
    paymentRequirements,
    creConfig
  );

  const includePermit = options?.includePermit ?? false;
  const facilitatorAddress =
    options?.facilitatorAddress ?? paymentRequirements.extra?.creContract;

  if (!includePermit || !facilitatorAddress) {
    return payload;
  }

  const tokenAddress = paymentRequirements.asset as `0x${string}`;
  const chainId = getChainIdFromNetwork(paymentRequirements.network);

  if (!checkPermitSupport(tokenAddress, chainId)) {
    return payload;
  }

  const validUntilTs = BigInt(payload.payload.authorization.validUntil);
  const permitDeadline = options?.permitDeadline ?? validUntilTs + 3600n;

  try {
    const permit = await createPermitSignature(
      walletClient,
      publicClient,
      tokenAddress as `0x${string}`,
      facilitatorAddress,
      BigInt(paymentRequirements.amount),
      permitDeadline,
      chainId
    );

    payload.payload.permit = permit;
  } catch (error) {
    // If permit creation fails, log warning and continue without permit
    console.warn(
      'Failed to create permit signature, continuing without permit:',
      error
    );
  }

  return payload;
}
