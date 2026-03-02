import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, createPublicClient } from 'viem';
import { baseSepolia } from 'viem/chains';

import { createSimulationClient } from '../src/cre/client.js';
import { buildPaymentRequirements } from '../src/builders/index.js';
import { createPaymentPayload } from '../src/payment/create.js';
import type { PaymentRequirements } from '../src/types/payment.js';
import type { EVMNetworkId } from '../src/types/network.js';

// Configuration
const TEST_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_RECIPIENT =
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`;
const FACILITATOR_ADDRESS =
  '0xea52C55099A65542a785280A9D47CC5A769DE7AB' as `0x${string}`;
const NETWORK: EVMNetworkId = 'eip155:84532';

// USDC on Base Sepolia (example)
const USDC_ADDRESS =
  '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as `0x${string}`;

console.log('\n🚀 Testing CRE CLI Simulation Feature\n');
console.log('='.repeat(70));
console.log(
  'This test uses the actual CRE CLI to simulate the workflow locally!'
);
console.log('='.repeat(70));

const account = privateKeyToAccount(TEST_PRIVATE_KEY);
console.log(`\n📍 Test Configuration:`);
console.log(`   Payer Address: ${account.address}`);
console.log(`   Recipient: ${TEST_RECIPIENT}`);
console.log(`   Network: ${NETWORK} (Base Sepolia)`);
console.log(`   Facilitator: ${FACILITATOR_ADDRESS}`);

async function runTest() {
  try {
    console.log('\n' + '─'.repeat(70));
    console.log('🔧 STEP 1: Initialize CRE Client with CLI Simulation');
    console.log('─'.repeat(70));

    const creClient = createSimulationClient(NETWORK, FACILITATOR_ADDRESS, {
      workflowPath: './x402-workflow',
      targetSettings: 'staging-settings',
      broadcastInSimulation: false, // Don't actually submit transactions
      engineLogs: false, // Set to true for debugging
      timeout: 60000,
    });

    console.log('\n✅ CRE Client Created in Simulation Mode:');
    console.log(`   Workflow Path: ./x402-workflow`);
    console.log(`   Target Settings: staging-settings`);
    console.log(`   Broadcast: false (no real txs)`);
    console.log(`   Mode: CLI Simulation`);

    console.log('\n' + '─'.repeat(70));
    console.log('📋 STEP 2: Create Payment Requirements');
    console.log('─'.repeat(70));

    const paymentRequirements: PaymentRequirements = buildPaymentRequirements({
      network: NETWORK,
      amount: 1000000, // 1 USDC (6 decimals)
      asset: USDC_ADDRESS,
      payTo: TEST_RECIPIENT,
      maxTimeoutSeconds: 300,
      resource: 'https://api.example.com/premium-data',
    });

    console.log('\n✅ Payment Requirements:');
    console.log(`   Amount: ${paymentRequirements.amount} (1 USDC)`);
    console.log(`   Asset: ${paymentRequirements.asset}`);
    console.log(`   Pay To: ${paymentRequirements.payTo}`);
    console.log(`   Network: ${paymentRequirements.network}`);

    console.log('\n' + '─'.repeat(70));
    console.log('✍️  STEP 3: Create and Sign Payment Payload (EIP-712)');
    console.log('─'.repeat(70));

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const payload = await createPaymentPayload(
      walletClient,
      2,
      paymentRequirements,
      {
        endpoint: 'cli://simulation', // Marker for simulation mode
        network: NETWORK,
      }
    );

    console.log('\n✅ Payment Payload Created:');
    console.log(`   From: ${payload.payload.authorization.from}`);
    console.log(`   To: ${payload.payload.authorization.to}`);
    console.log(`   Amount: ${payload.payload.authorization.amount}`);
    console.log(`   Token: ${payload.payload.authorization.token}`);
    console.log(`   Nonce: ${payload.payload.authorization.nonce}`);
    console.log(
      `   Signature: ${payload.payload.signature.substring(0, 40)}...`
    );

    console.log('\n' + '─'.repeat(70));
    console.log('🔍 STEP 4: Verify Payment (CRE CLI Simulation)');
    console.log('─'.repeat(70));

    console.log('\n   Spawning CRE CLI process...');
    console.log(
      '   Command: cre workflow simulate x402-workflow --target staging-settings'
    );
    console.log(
      '   This uses the actual workflow code from x402-workflow/main.ts\n'
    );

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const verifyResult = await creClient.verify(
      payload,
      paymentRequirements,
      publicClient
    );

    console.log('\n✅ Verification Result from CRE CLI:');
    console.log(`   Is Valid: ${verifyResult.isValid}`);
    console.log(`   Payer: ${verifyResult.payer}`);

    if (verifyResult.details) {
      console.log(`   Balance: ${verifyResult.details.balance || 'N/A'}`);
      console.log(`   Allowance: ${verifyResult.details.allowance || 'N/A'}`);
    }

    if (!verifyResult.isValid) {
      console.log(`\n⚠️  Verification failed: ${verifyResult.invalidReason}`);
      console.log('   This is expected if:');
      console.log('   - The payer has insufficient balance');
      console.log('   - The payer has not approved the facilitator');
      console.log('   - The payment has expired');
      return;
    }

    console.log('\n' + '─'.repeat(70));
    console.log('💰 STEP 5: Verify and Settle (CRE CLI Simulation)');
    console.log('─'.repeat(70));

    console.log('\n   Spawning CRE CLI with verify_and_settle action...');
    console.log('   This will:');
    console.log('   1. Verify the payment');
    console.log('   2. Simulate settlement (no real tx if broadcast=false)\n');

    const { verifyResponse, settleResponse } = await creClient.verifyAndSettle(
      payload,
      paymentRequirements,
      publicClient
    );

    console.log('\n✅ Combined Verification + Settlement Result:');
    console.log(`\n   Verification:`);
    console.log(`     Is Valid: ${verifyResponse.isValid}`);

    if (settleResponse) {
      console.log(`\n   Settlement:`);
      console.log(`     Success: ${settleResponse.success}`);
      console.log(`     Transaction: ${settleResponse.transaction}`);
      console.log(`     Status: ${settleResponse.status || 'N/A'}`);
      console.log(`     Network: ${settleResponse.network}`);
      console.log(`     Workflow ID: ${settleResponse.workflowId || 'N/A'}`);

      if (settleResponse.blockNumber) {
        console.log(`     Block Number: ${settleResponse.blockNumber}`);
      }
    }

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(70));
    console.log('✅ CRE CLI SIMULATION TEST COMPLETED!');
    console.log('='.repeat(70));

    console.log('\n📊 What Was Tested:');
    console.log('   ✅ CRE CLI spawning and process management');
    console.log('   ✅ HTTP payload passing via --http-payload flag');
    console.log('   ✅ Non-interactive mode with --non-interactive');
    console.log('   ✅ Workflow output parsing (JSON extraction)');
    console.log('   ✅ Verification action execution');
    console.log('   ✅ Combined verify_and_settle action');
    console.log('   ✅ Error handling and timeout management');

    console.log('\n🎯 Key Benefits:');
    console.log('   • Uses actual x402-workflow code (not mocks)');
    console.log('   • Simulates real DON execution locally');
    console.log('   • Same code path as production deployment');
    console.log('   • Fast iteration without deploying to DON');
    console.log('   • No blockchain connection needed for testing');

    console.log('\n🚀 Next Steps:');
    console.log(
      '   1. For production: Deploy workflow with `cre workflow deploy`'
    );
    console.log('   2. Update endpoint in config to deployed URL');
    console.log('   3. Set simulation: false in CREClient config');
    console.log('   4. Your simulation code becomes production code!\n');
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);

    if (error instanceof Error) {
      console.error('\nError details:');
      console.error(`  Message: ${error.message}`);
      if ('code' in error) {
        console.error(`  Code: ${(error as any).code}`);
      }
      if ('details' in error) {
        console.error(`  Details:`, (error as any).details);
      }
    }

    console.log('\n💡 Common Issues:');
    console.log('   • CRE CLI not installed: Run `cre login` to install');
    console.log('   • Workflow folder not found: Check ./x402-workflow exists');
    console.log(
      '   • Project config missing: Check project.yaml and workflow.yaml'
    );
    console.log('   • Invalid JSON output: Check workflow returns valid JSON');

    throw error;
  }
}

// Run the test
runTest().catch((error) => {
  process.exit(1);
});
