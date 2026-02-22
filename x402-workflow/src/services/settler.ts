import {
  type Runtime,
  EVMClient,
  prepareReportRequest,
  bytesToHex,
} from "@chainlink/cre-sdk"
import { encodeAbiParameters, parseAbiParameters } from "viem"
import type { Config, PaymentRequest, SettlementResult } from "../types/index"
import { ZERO_ADDRESS } from "../utils/constants"

/**
 * Submit settlement report via EVM Write
 * The X402Facilitator contract will execute the actual token transfer
 * If permit data is provided, it will be included in the report for gasless approval
 */
export function submitSettlement(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  request: PaymentRequest
): SettlementResult {
  const { authorization, signature, permit } = request
  const facilitatorAddress = runtime.config.facilitatorAddress as `0x${string}`

  try {
    if (!authorization.token) {
      return {
        reportSubmitted: false,
        error: "Token address is required",
      }
    }

    const tokenAddress = authorization.token as `0x${string}`

    const permitDeadline = permit ? BigInt(permit.deadline) : 0n
    const permitV = permit ? permit.v : 0
    const permitR = permit ? (permit.r as `0x${string}`) : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`)
    const permitS = permit ? (permit.s as `0x${string}`) : ("0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`)

    if (permit) {
      runtime.log(`[x402] Including permit data (deadline: ${permit.deadline})`)
    }

    const reportData = encodeAbiParameters(
      parseAbiParameters(
        "address from, address to, uint256 amount, address token, uint256 nonce, uint256 validUntil, uint256 chainId, bytes signature, uint256 permitDeadline, uint8 permitV, bytes32 permitR, bytes32 permitS"
      ),
      [
        authorization.from as `0x${string}`,
        authorization.to as `0x${string}`,
        BigInt(authorization.amount),
        tokenAddress,
        BigInt(authorization.nonce),
        BigInt(authorization.validUntil),
        BigInt(authorization.chainId),
        signature as `0x${string}`,
        permitDeadline,
        permitV,
        permitR,
        permitS,
      ]
    )

    runtime.log(`[x402] Submitting report to ${facilitatorAddress}`)

    const signedReport = runtime
      .report(prepareReportRequest(reportData))
      .result()

    const writeResult = evmClient
      .writeReport(runtime, {
        receiver: facilitatorAddress,
        report: signedReport,
        gasConfig: { gasLimit: "500000" },
      })
      .result()

    const txHash = writeResult.txHash
      ? bytesToHex(writeResult.txHash)
      : ""

    return {
      reportSubmitted: true,
      txHash,
    }
  } catch (e) {
    runtime.log(`[x402] Settlement error: ${String(e)}`)
    return {
      reportSubmitted: false,
      error: String(e),
    }
  }
}
