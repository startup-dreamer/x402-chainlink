import {
  type Runtime,
  EVMClient,
  LAST_FINALIZED_BLOCK_NUMBER,
  encodeCallMsg,
  bytesToHex,
} from "@chainlink/cre-sdk"
import { encodeFunctionData, decodeFunctionResult } from "viem"
import { ERC20ABI } from "../../abi/ERC20"
import type { Config, PaymentRequest, VerificationResult } from "../types/index"
import { ZERO_ADDRESS } from "../utils/constants"

/**
 * Verify payment authorization
 * Checks expiry, balance, and allowance on-chain
 * Note: If permit is provided, allowance check is skipped
 */
export function verifyPayment(
  runtime: Runtime<Config>,
  evmClient: EVMClient,
  request: PaymentRequest
): VerificationResult {
  const { authorization, permit } = request
  const facilitatorAddress = runtime.config.facilitatorAddress as `0x${string}`
  const amount = BigInt(authorization.amount)

  const now = Math.floor(Date.now() / 1000)
  const validUntil = parseInt(authorization.validUntil)
  if (validUntil !== 0 && now > validUntil) {
    return {
      isValid: false,
      reason: "payment_expired",
    }
  }

  if (!authorization.from || authorization.from === ZERO_ADDRESS) {
    return {
      isValid: false,
      reason: "invalid_from_address",
    }
  }

  if (!authorization.to || authorization.to === ZERO_ADDRESS) {
    return {
      isValid: false,
      reason: "invalid_to_address",
    }
  }

  if (!authorization.token || authorization.token === ZERO_ADDRESS) {
    return {
      isValid: false,
      reason: "invalid_token_address",
    }
  }

  if (amount <= 0n) {
    return {
      isValid: false,
      reason: "invalid_amount",
    }
  }

  const tokenAddress = authorization.token as `0x${string}`
  let balance = "0"

  try {
    const balanceCallData = encodeFunctionData({
      abi: ERC20ABI,
      functionName: "balanceOf",
      args: [authorization.from as `0x${string}`],
    })

    const balanceResponse = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: ZERO_ADDRESS,
          to: tokenAddress,
          data: balanceCallData,
        }),
        blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
      })
      .result()

    const decoded = decodeFunctionResult({
      abi: ERC20ABI,
      functionName: "balanceOf",
      data: bytesToHex(balanceResponse.data),
    }) as bigint

    balance = decoded.toString()
  } catch (e) {
    runtime.log(`[x402] Balance check failed: ${String(e)}`)
    return {
      isValid: false,
      reason: "balance_check_failed",
    }
  }

  if (BigInt(balance) < amount) {
    return {
      isValid: false,
      reason: "insufficient_balance",
      balance,
    }
  }

  let allowance = "0"

  if (permit) {
    runtime.log("[x402] Permit provided - skipping allowance check")
    allowance = "permit_pending"
  } else {
    try {
      const allowanceCallData = encodeFunctionData({
        abi: ERC20ABI,
        functionName: "allowance",
        args: [authorization.from as `0x${string}`, facilitatorAddress],
      })

      const allowanceResponse = evmClient
        .callContract(runtime, {
          call: encodeCallMsg({
            from: ZERO_ADDRESS,
            to: tokenAddress,
            data: allowanceCallData,
          }),
          blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
        })
        .result()

      const decoded = decodeFunctionResult({
        abi: ERC20ABI,
        functionName: "allowance",
        data: bytesToHex(allowanceResponse.data),
      }) as bigint

      allowance = decoded.toString()
    } catch (e) {
      runtime.log(`[x402] Allowance check failed: ${String(e)}`)
      return {
        isValid: false,
        reason: "allowance_check_failed",
        balance,
      }
    }

    if (BigInt(allowance) < amount) {
      return {
        isValid: false,
        reason: "insufficient_allowance",
        balance,
        allowance,
      }
    }
  }

  return {
    isValid: true,
    balance,
    allowance,
  }
}
