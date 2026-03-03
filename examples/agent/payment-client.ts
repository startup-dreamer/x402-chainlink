import {
  createWalletClient,
  createPublicClient,
  http,
  type WalletClient,
  type Transport,
  type Chain,
  type Account,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';


export const PAYMENT_HEADERS = {
  REQUIRED: 'PAYMENT-REQUIRED',
  SIGNATURE: 'PAYMENT-SIGNATURE',
  RESPONSE: 'PAYMENT-RESPONSE',
} as const;


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

export interface PermitData {
  deadline: string;
  v: number;
  r: `0x${string}`;
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
    permit?: PermitData;
  };
  typedData?: object;
  creEndpoint?: string;
}

// ── EIP-2612 permit types ────────────────────────────────────────────────────

const PERMIT_EIP712_TYPES = {
  Permit: [
    { name: 'owner',    type: 'address' },
    { name: 'spender',  type: 'address' },
    { name: 'value',    type: 'uint256' },
    { name: 'nonce',    type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;


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

const NONCES_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;


function chainIdFromNetwork(network: string): number {
  const match = /^eip155:(\d+)$/.exec(network);
  if (!match?.[1]) throw new Error(`Unsupported network: ${network}`);
  return parseInt(match[1], 10);
}


export function decodePaymentRequired(header: string): PaymentRequired {
  const json = Buffer.from(header, 'base64').toString('utf8');
  return JSON.parse(json) as PaymentRequired;
}

export function encodePaymentPayload(payload: PaymentPayload): string {
  const json = JSON.stringify(payload, (_, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
  return Buffer.from(json).toString('base64');
}

export function decodeSettleResponse(header: string): SettleResponse {
  const json = Buffer.from(header, 'base64').toString('utf8');
  return JSON.parse(json) as SettleResponse;
}


export function createAgentWallet(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  return { account, walletClient, publicClient };
}


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
    typedData: {
      domain,
      types: X402_EIP712_TYPES,
      primaryType: 'PaymentAuthorization',
      message: {
        from,
        to: requirements.payTo,
        amount: requirements.amount,
        token: tokenAddress,
        nonce,
        validUntil,
        chainId,
      },
    },
    creEndpoint: 'cli://simulation',
  };
}


const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;
const USDC_NAME = 'USDC';
const USDC_VERSION = '2';

export async function signPermitIfApplicable<
  TTransport extends Transport = Transport,
  TChain extends Chain = Chain,
  TAccount extends Account = Account,
>(
  walletClient: WalletClient<TTransport, TChain, TAccount>,
  requirements: PaymentRequirements,
  payload: PaymentPayload
): Promise<void> {
  const facilitatorAddress = (requirements.extra?.creContract ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`;

  if (
    !requirements.asset ||
    requirements.asset.toLowerCase() !== USDC_BASE_SEPOLIA.toLowerCase() ||
    facilitatorAddress === '0x0000000000000000000000000000000000000000'
  ) {
    return;
  }

  try {
    const account = walletClient.account!;
    const chainId = chainIdFromNetwork(requirements.network);
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http() });

    const nonce = await publicClient.readContract({
      address: USDC_BASE_SEPOLIA,
      abi: NONCES_ABI,
      functionName: 'nonces',
      args: [account.address],
    });

    const permitDeadline = Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds;

    const domain = {
      name: USDC_NAME,
      version: USDC_VERSION,
      chainId,
      verifyingContract: USDC_BASE_SEPOLIA,
    };

    const message = {
      owner: account.address as `0x${string}`,
      spender: facilitatorAddress,
      value: BigInt(requirements.amount),
      nonce,
      deadline: BigInt(permitDeadline),
    };

    const sig = await walletClient.signTypedData({
      account,
      domain,
      types: PERMIT_EIP712_TYPES,
      primaryType: 'Permit',
      message,
    });

    const r = sig.slice(0, 66) as `0x${string}`;
    const s = `0x${sig.slice(66, 130)}` as `0x${string}`;
    const v = parseInt(sig.slice(130, 132), 16);

    payload.payload.permit = {
      deadline: BigInt(permitDeadline).toString(),
      v,
      r,
      s,
    };
  } catch {
    // proceed without permit
  }
}
