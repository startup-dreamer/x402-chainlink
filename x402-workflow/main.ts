/**
 * x402 Payment Workflow for Chainlink Runtime Environment (CRE)
 */

import {
  HTTPCapability,
  EVMClient,
  handler,
  Runner,
  type Runtime,
  type HTTPPayload,
  getNetwork,
} from "@chainlink/cre-sdk"
import type { Config, PaymentRequest, WorkflowResponse } from "./src/types/index"
import { verifyPayment } from "./src/services/verifier"
import { submitSettlement } from "./src/services/settler"

const onHttpTrigger = (
  runtime: Runtime<Config>,
  payload: HTTPPayload
): WorkflowResponse => {
  const timestamp = Date.now()

  try {
    // CRE CLI v1.1.0 corrupts the last 2 bytes of --http-payload (known bug).
    // The cli-executor pads the payload with '!!' so the actual closing braces
    // are preserved. We decode with replacement chars, then truncate at the
    // last '}' to strip the '!!' padding and any corrupted bytes.
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(payload.input)
    const lastBrace = rawText.lastIndexOf('}')
    const cleanText = lastBrace !== -1 ? rawText.slice(0, lastBrace + 1) : rawText
    const request = JSON.parse(cleanText) as PaymentRequest
    runtime.log(`[x402] Processing ${request.action} for ${request.authorization.from}`)

    const network = getNetwork({
      chainSelectorName: runtime.config.chainName,
      isTestnet: true,
    })
    if (!network) {
      throw new Error(`Unknown chain: ${runtime.config.chainName}`)
    }

    const evmClient = new EVMClient(network.chainSelector.selector)

    const response: WorkflowResponse = {
      success: false,
      action: request.action,
      timestamp,
    }

    if (request.action === "verify" || request.action === "verify_and_settle") {
      runtime.log("[x402] Starting verification...")
      const verification = verifyPayment(runtime, evmClient, request)
      response.verification = verification

      if (!verification.isValid) {
        response.error = verification.reason
        runtime.log(`[x402] Verification failed: ${verification.reason}`)
        return JSON.parse(JSON.stringify(response)) as WorkflowResponse
      }

      runtime.log("[x402] Verification successful")

      if (request.action === "verify") {
        response.success = true
        return JSON.parse(JSON.stringify(response)) as WorkflowResponse
      }
    }

    if (request.action === "settle" || request.action === "verify_and_settle") {
      runtime.log("[x402] Starting settlement...")
      const settlement = submitSettlement(runtime, evmClient, request)
      response.settlement = settlement

      if (!settlement.reportSubmitted) {
        response.error = settlement.error || "Settlement report submission failed"
        runtime.log(`[x402] Settlement failed: ${response.error}`)
        return JSON.parse(JSON.stringify(response)) as WorkflowResponse
      }

      runtime.log(`[x402] Settlement submitted: ${settlement.txHash}`)
    }

    response.success = true
    runtime.log("[x402] Request completed successfully")
    // Strip undefined values to avoid CRE SDK serialization error
    return JSON.parse(JSON.stringify(response)) as WorkflowResponse
  } catch (error) {
    runtime.log(`[x402] Error: ${String(error)}`)
    return JSON.parse(JSON.stringify({
      success: false,
      action: "unknown",
      error: String(error),
      timestamp,
    })) as WorkflowResponse
  }
}

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability()
  console.log(`[x402] Workflow initialized`)
  console.log(`[x402] Facilitator: ${config.facilitatorAddress}`)
  console.log(`[x402] Chain: ${config.chainName}`)
  return [handler(http.trigger({}), onHttpTrigger)]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}
