import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import {
  createFacilitatorClient,
  createPaymentPayload,
  buildUSDCPayment,
  type PaymentPayload,
} from 'x402-chainlink';

const FACILITATOR_URL = process.env.FACILITATOR_URL ?? 'http://localhost:3001';
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
const NETWORK = 'eip155:84532' as const; // Base Sepolia
const RECIPIENT = '0x0000000000000000000000000000000000000000' as `0x${string}`;

async function main() {
  console.log('🚀 Facilitator Client Example');
  console.log('='.repeat(50));

  // Create facilitator client
  const facilitator = createFacilitatorClient({
    baseUrl: FACILITATOR_URL,
  });

  // Step 1: Check supported payment kinds
  console.log('\n📋 Checking supported payment kinds...');
  try {
    const supported = await facilitator.supported();
    console.log(`   Supported kinds: ${supported.kinds.length}`);
    console.log(
      `   Networks: ${supported.kinds.map((k) => k.network).join(', ')}`
    );
    console.log(`   Extensions: ${supported.extensions.join(', ') || 'none'}`);
  } catch (error) {
    console.log(`   ❌ Could not reach facilitator at ${FACILITATOR_URL}`);
    console.log(`   Make sure the facilitator service is running.`);
    return;
  }

  // Step 2: Create a test payment (requires private key)
  if (!PRIVATE_KEY) {
    console.log('\n⚠️  Set PRIVATE_KEY to test verification and settlement');
    return;
  }

  const account = privateKeyToAccount(PRIVATE_KEY);
  console.log(`\n🔑 Wallet address: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Build payment requirements
  const requirements = buildUSDCPayment({
    network: NETWORK,
    amount: 0.01, // $0.01 USDC
    payTo: RECIPIENT,
  });

  console.log('\n💳 Creating payment payload...');
  const payload = await createPaymentPayload(walletClient, 2, requirements, {
    endpoint: FACILITATOR_URL,
    network: NETWORK,
    simulation: true,
  });

  console.log(`   Signature: ${payload.payload.signature.slice(0, 20)}...`);
  console.log(`   Payer: ${payload.payload.authorization.from}`);
  console.log(`   Amount: ${payload.payload.authorization.amount}`);

  // Step 3: Verify the payment
  console.log('\n🔍 Verifying payment...');
  const verification = await facilitator.verify(payload, requirements);

  if (verification.isValid) {
    console.log(`   ✅ Payment is valid!`);
    console.log(`   Payer: ${verification.payer}`);
    console.log(`   Balance: ${verification.details?.balance ?? 'unknown'}`);
  } else {
    console.log(`   ❌ Payment is invalid: ${verification.invalidReason}`);
    console.log(`   Details: ${JSON.stringify(verification.details)}`);
    return;
  }

  // Step 4: Settle the payment
  console.log('\n💸 Settling payment...');
  const settlement = await facilitator.settle(payload, requirements);

  if (settlement.success) {
    console.log(`   ✅ Settlement successful!`);
    console.log(`   Transaction: ${settlement.transaction}`);
    console.log(`   Network: ${settlement.network}`);
    console.log(`   Status: ${settlement.status}`);
  } else {
    console.log(`   ❌ Settlement failed: ${settlement.errorReason}`);
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
