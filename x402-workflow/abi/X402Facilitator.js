"use strict";
/**
 * X402Facilitator Contract ABI
 * Used by CRE workflow for interacting with the facilitator contract
 *
 * Settlement Report Format (with EIP-2612 permit support):
 * - from: address - Payer address
 * - to: address - Recipient address
 * - amount: uint256 - Payment amount
 * - token: address - Token address (address(0) for ETH)
 * - nonce: uint256 - Payment nonce
 * - validUntil: uint256 - Expiry timestamp
 * - chainId: uint256 - Chain ID
 * - signature: bytes - EIP-712 payment signature
 * - permitDeadline: uint256 - Permit deadline (0 = no permit)
 * - permitV: uint8 - Permit signature v
 * - permitR: bytes32 - Permit signature r
 * - permitS: bytes32 - Permit signature s
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.X402FacilitatorABI = exports.SETTLEMENT_REPORT_PARAMS = void 0;
/**
 * ABI parameter types for encoding the settlement report
 * Use with viem's encodeAbiParameters:
 * ```ts
 * const reportData = encodeAbiParameters(SETTLEMENT_REPORT_PARAMS, [
 *   from, to, amount, token, nonce, validUntil, chainId, signature,
 *   permitDeadline, permitV, permitR, permitS
 * ])
 * ```
 */
exports.SETTLEMENT_REPORT_PARAMS = [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "token", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "chainId", type: "uint256" },
    { name: "signature", type: "bytes" },
    { name: "permitDeadline", type: "uint256" },
    { name: "permitV", type: "uint8" },
    { name: "permitR", type: "bytes32" },
    { name: "permitS", type: "bytes32" },
];
exports.X402FacilitatorABI = [
    // ============================================================================
    // Events
    // ============================================================================
    {
        type: "event",
        name: "PaymentSettled",
        inputs: [
            { indexed: true, name: "from", type: "address" },
            { indexed: true, name: "to", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "amount", type: "uint256" },
            { indexed: false, name: "nonce", type: "uint256" },
            { indexed: false, name: "paymentHash", type: "bytes32" },
        ],
    },
    {
        type: "event",
        name: "ForwarderAddressUpdated",
        inputs: [
            { indexed: true, name: "previousForwarder", type: "address" },
            { indexed: true, name: "newForwarder", type: "address" },
        ],
    },
    {
        type: "event",
        name: "ExpectedWorkflowIdUpdated",
        inputs: [
            { indexed: true, name: "previousId", type: "bytes32" },
            { indexed: true, name: "newId", type: "bytes32" },
        ],
    },
    {
        type: "event",
        name: "ExpectedAuthorUpdated",
        inputs: [
            { indexed: true, name: "previousAuthor", type: "address" },
            { indexed: true, name: "newAuthor", type: "address" },
        ],
    },
    {
        type: "event",
        name: "SecurityWarning",
        inputs: [{ indexed: false, name: "message", type: "string" }],
    },
    {
        type: "event",
        name: "PermitExecuted",
        inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "value", type: "uint256" },
            { indexed: false, name: "deadline", type: "uint256" },
        ],
    },
    {
        type: "event",
        name: "PermitSkipped",
        inputs: [
            { indexed: true, name: "owner", type: "address" },
            { indexed: true, name: "token", type: "address" },
            { indexed: false, name: "existingAllowance", type: "uint256" },
        ],
    },
    // ============================================================================
    // Errors
    // ============================================================================
    {
        type: "error",
        name: "UnauthorizedForwarder",
        inputs: [
            { name: "caller", type: "address" },
            { name: "expected", type: "address" },
        ],
    },
    {
        type: "error",
        name: "InvalidSignature",
        inputs: [
            { name: "expectedSigner", type: "address" },
            { name: "recoveredSigner", type: "address" },
        ],
    },
    {
        type: "error",
        name: "NonceAlreadyUsed",
        inputs: [
            { name: "from", type: "address" },
            { name: "nonce", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "PaymentExpired",
        inputs: [
            { name: "validUntil", type: "uint256" },
            { name: "currentTime", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "TransferFailed",
        inputs: [
            { name: "token", type: "address" },
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "InvalidChainId",
        inputs: [
            { name: "expected", type: "uint256" },
            { name: "provided", type: "uint256" },
        ],
    },
    {
        type: "error",
        name: "ZeroAddress",
        inputs: [{ name: "parameter", type: "string" }],
    },
    {
        type: "error",
        name: "ZeroAmount",
        inputs: [],
    },
    {
        type: "error",
        name: "InsufficientAllowance",
        inputs: [
            { name: "owner", type: "address" },
            { name: "currentAllowance", type: "uint256" },
            { name: "required", type: "uint256" },
        ],
    },
    // ============================================================================
    // Read Functions
    // ============================================================================
    {
        type: "function",
        name: "PAYMENT_AUTHORIZATION_TYPEHASH",
        inputs: [],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "EIP712_NAME",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "EIP712_VERSION",
        inputs: [],
        outputs: [{ name: "", type: "string" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "s_forwarderAddress",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "s_expectedWorkflowId",
        inputs: [],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "s_expectedAuthor",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "usedNonces",
        inputs: [
            { name: "user", type: "address" },
            { name: "nonce", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "isNonceUsed",
        inputs: [
            { name: "user", type: "address" },
            { name: "nonce", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "totalPaymentsSettled",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "volumeByToken",
        inputs: [{ name: "token", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "domainSeparator",
        inputs: [],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "hashPaymentAuthorization",
        inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
            { name: "token", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "validUntil", type: "uint256" },
            { name: "chainId", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bytes32" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "owner",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
        stateMutability: "view",
    },
    {
        type: "function",
        name: "supportsInterface",
        inputs: [{ name: "interfaceId", type: "bytes4" }],
        outputs: [{ name: "", type: "bool" }],
        stateMutability: "view",
    },
    // ============================================================================
    // Write Functions
    // ============================================================================
    {
        type: "function",
        name: "onReport",
        inputs: [
            { name: "metadata", type: "bytes" },
            { name: "report", type: "bytes" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setForwarderAddress",
        inputs: [{ name: "_forwarder", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setExpectedWorkflowId",
        inputs: [{ name: "_id", type: "bytes32" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "setExpectedAuthor",
        inputs: [{ name: "_author", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "renounceOwnership",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable",
    },
    {
        type: "function",
        name: "transferOwnership",
        inputs: [{ name: "newOwner", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
    },
    // ============================================================================
    // Constructor
    // ============================================================================
    {
        type: "constructor",
        inputs: [{ name: "_forwarderAddress", type: "address" }],
        stateMutability: "nonpayable",
    },
    // ============================================================================
    // Receive
    // ============================================================================
    {
        type: "receive",
        stateMutability: "payable",
    },
];
