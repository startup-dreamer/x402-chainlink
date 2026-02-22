export type Config = {
  facilitatorAddress: string
  chainName: string
}

export type PermitData = {
  deadline: string
  v: number
  r: string
  s: string
}

export type PaymentRequest = {
  action: "verify" | "settle" | "verify_and_settle"
  signature: string
  authorization: {
    from: string
    to: string
    amount: string
    token: string | null
    nonce: string
    validUntil: string
    chainId: number
  }
  permit?: PermitData
}

export type VerificationResult = {
  isValid: boolean
  reason?: string
  balance?: string
  allowance?: string
}

export type SettlementResult = {
  reportSubmitted: boolean
  txHash?: string
  error?: string
}

export type WorkflowResponse = {
  success: boolean
  action: string
  verification?: VerificationResult
  settlement?: SettlementResult
  error?: string
  timestamp: number
}
