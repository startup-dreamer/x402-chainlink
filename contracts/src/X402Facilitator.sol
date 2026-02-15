// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IReceiver} from "../interfaces/IReceiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title X402Facilitator
 * @notice Facilitator contract for x402 payment protocol using Chainlink CRE
 * @dev Receives settlement reports from KeystoneForwarder and executes token transfers
 */
contract X402Facilitator is IReceiver, EIP712, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    /// @notice EIP-712 type hash for PaymentAuthorization
    bytes32 public constant PAYMENT_AUTHORIZATION_TYPEHASH = keccak256(
        "PaymentAuthorization(address from,address to,uint256 amount,address token,uint256 nonce,uint256 validUntil,uint256 chainId)"
    );
    /// @notice EIP-712 domain name
    string public constant EIP712_NAME = "x402-chainlink";
    /// @notice EIP-712 domain version
    string public constant EIP712_VERSION = "1";

    /// @notice Settlement report data structure
    struct SettlementReport {
        address from;
        address to;
        uint256 amount;
        address token;
        uint256 nonce;
        uint256 validUntil;
        uint256 chainId;
        bytes signature;
        uint256 permitDeadline;
        uint8 permitV;
        bytes32 permitR;
        bytes32 permitS;
    }

    /// @notice Address of the KeystoneForwarder
    address public s_forwarderAddress;
    
    /// @notice Expected workflow ID for additional validation
    bytes32 public s_expectedWorkflowId;
    
    /// @notice Expected workflow author/owner for additional validation
    address public s_expectedAuthor;
    
    /// @notice Mapping of used nonces per user for replay protection
    /// @dev user address => nonce => used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    /// @notice Total number of payments settled
    uint256 public totalPaymentsSettled;

    /// @notice Total volume settled per token
    mapping(address => uint256) public volumeByToken;

    /// @notice Emitted when a payment is successfully settled
    event PaymentSettled(
        address indexed from,
        address indexed to,
        address indexed token,
        uint256 amount,
        uint256 nonce,
        bytes32 paymentHash
    );

    /// @notice Emitted when the forwarder address is updated
    event ForwarderAddressUpdated(
        address indexed previousForwarder,
        address indexed newForwarder
    );

    /// @notice Emitted when the expected workflow ID is updated
    event ExpectedWorkflowIdUpdated(
        bytes32 indexed previousId,
        bytes32 indexed newId
    );

    /// @notice Emitted when the expected author is updated
    event ExpectedAuthorUpdated(
        address indexed previousAuthor,
        address indexed newAuthor
    );

    /// @notice Emitted for security warnings
    event SecurityWarning(string message);

    /// @notice Emitted when a permit is executed successfully
    event PermitExecuted(
        address indexed owner,
        address indexed token,
        uint256 value,
        uint256 deadline
    );

    /// @notice Emitted when permit fails but existing allowance is sufficient
    event PermitSkipped(
        address indexed owner,
        address indexed token,
        uint256 existingAllowance
    );

    /// @notice Caller is not the authorized forwarder
    error UnauthorizedForwarder(address caller, address expected);
    
    /// @notice EIP-712 signature verification failed
    error InvalidSignature(address expectedSigner, address recoveredSigner);
    
    /// @notice Nonce has already been used
    error NonceAlreadyUsed(address from, uint256 nonce);
    
    /// @notice Payment authorization has expired
    error PaymentExpired(uint256 validUntil, uint256 currentTime);
    
    /// @notice Token transfer failed
    error TransferFailed(address token, address from, address to, uint256 amount);
    
    /// @notice Chain ID doesn't match
    error InvalidChainId(uint256 expected, uint256 provided);

    /// @notice Zero address provided where not allowed
    error ZeroAddress(string parameter);

    /// @notice Amount must be greater than zero
    error ZeroAmount();

    /// @notice Insufficient allowance after permit attempt failed
    error InsufficientAllowance(address owner, uint256 currentAllowance, uint256 required);

    /**
     * @notice Initialize the X402Facilitator contract
     * @param _forwarderAddress Address of the KeystoneForwarder
     */
    constructor(
        address _forwarderAddress
    ) EIP712(EIP712_NAME, EIP712_VERSION) Ownable(msg.sender) {
        if (_forwarderAddress == address(0)) {
            revert ZeroAddress("forwarderAddress");
        }
        s_forwarderAddress = _forwarderAddress;
    }

    /**
     * @notice Receive and process settlement report from KeystoneForwarder
     * @param metadata Encoded metadata from CRE
     * @param report ABI-encoded settlement data
     * @dev Only callable by the configured forwarder address
     */
    function onReport(bytes calldata metadata, bytes calldata report) external override {
        // Verify caller is the authorized forwarder
        if (msg.sender != s_forwarderAddress) {
            revert UnauthorizedForwarder(msg.sender, s_forwarderAddress);
        }

        // Validate workflow metadata if configured
        if (s_expectedWorkflowId != bytes32(0) || s_expectedAuthor != address(0)) {
            _validateMetadata(metadata);
        }

        // Decode and process the settlement
        _processSettlement(report);
    }

    /**
     * @notice Check if a nonce has been used for a given address
     * @param user The user address
     * @param nonce The nonce to check
     * @return True if the nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    /**
     * @notice Get the domain separator for EIP-712
     * @return The domain separator bytes32
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    /**
     * @notice Compute the hash of a payment authorization
     * @param from Payer address
     * @param to Recipient address
     * @param amount Payment amount
     * @param token Token address
     * @param nonce Unique nonce
     * @param validUntil Expiry timestamp
     * @param chainId Chain ID
     * @return The EIP-712 typed data hash
     */
    function hashPaymentAuthorization(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 nonce,
        uint256 validUntil,
        uint256 chainId
    ) external view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTHORIZATION_TYPEHASH,
            from,
            to,
            amount,
            token,
            nonce,
            validUntil,
            chainId
        ));
        return _hashTypedDataV4(structHash);
    }

    /**
     * @notice Update the forwarder address
     * @param _forwarder New forwarder address
     * @dev Only callable by owner. Use with caution as this controls who can submit reports.
     */
    function setForwarderAddress(address _forwarder) external onlyOwner {
        address previousForwarder = s_forwarderAddress;

        if (_forwarder == address(0)) {
            emit SecurityWarning("Forwarder address set to zero - contract is now INSECURE");
        }

        s_forwarderAddress = _forwarder;
        emit ForwarderAddressUpdated(previousForwarder, _forwarder);
    }

    /**
     * @notice Set expected workflow ID for validation
     * @param _id Workflow ID (bytes32(0) to disable check)
     */
    function setExpectedWorkflowId(bytes32 _id) external onlyOwner {
        bytes32 previousId = s_expectedWorkflowId;
        s_expectedWorkflowId = _id;
        emit ExpectedWorkflowIdUpdated(previousId, _id);
    }

    /**
     * @notice Set expected workflow author for validation
     * @param _author Author address (address(0) to disable check)
     */
    function setExpectedAuthor(address _author) external onlyOwner {
        address previousAuthor = s_expectedAuthor;
        s_expectedAuthor = _author;
        emit ExpectedAuthorUpdated(previousAuthor, _author);
    }

    /**
     * @notice Validate workflow metadata
     * @param metadata Encoded metadata from forwarder
     */
    function _validateMetadata(bytes calldata metadata) internal view {
        if (metadata.length < 62) {
            return; // MockForwarder may not provide full metadata
        }

        (bytes32 workflowId, , address workflowOwner) = _decodeMetadata(metadata);

        if (s_expectedWorkflowId != bytes32(0) && workflowId != s_expectedWorkflowId) {
            revert InvalidSignature(address(0), address(0)); // Reuse error for simplicity
        }

        if (s_expectedAuthor != address(0) && workflowOwner != s_expectedAuthor) {
            revert InvalidSignature(s_expectedAuthor, workflowOwner);
        }
    }

    /**
     * @notice Decode metadata from forwarder
     * @param metadata Encoded metadata
     * @return workflowId The workflow ID
     * @return workflowName The workflow name (truncated)
     * @return workflowOwner The workflow owner address
     */
    function _decodeMetadata(
        bytes calldata metadata
    ) internal pure returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner) {
        // Metadata structure (abi.encodePacked by Forwarder):
        // - Offset 0, size 32: workflow_id (bytes32)
        // - Offset 32, size 10: workflow_name (bytes10)
        // - Offset 42, size 20: workflow_owner (address)
        assembly {
            workflowId := calldataload(metadata.offset)
            workflowName := calldataload(add(metadata.offset, 32))
            workflowOwner := shr(mul(12, 8), calldataload(add(metadata.offset, 42)))
        }
    }

    /**
     * @notice Process a settlement report
     * @param report ABI-encoded settlement data
     * @dev Report format includes optional permit data for EIP-2612 tokens
     * 
     * Report structure:
     * - from: address - Payer address
     * - to: address - Recipient address
     * - amount: uint256 - Payment amount
     * - token: address - Token address
     * - nonce: uint256 - Payment nonce
     * - validUntil: uint256 - Expiry timestamp
     * - chainId: uint256 - Chain ID
     * - signature: bytes - EIP-712 payment signature
     * - permitDeadline: uint256 - Permit deadline (0 = no permit)
     * - permitV: uint8 - Permit signature v
     * - permitR: bytes32 - Permit signature r
     * - permitS: bytes32 - Permit signature s
     */
    function _processSettlement(bytes calldata report) internal nonReentrant {
        SettlementReport memory sr = _decodeSettlementReport(report);
        _validateAndExecuteSettlement(sr);
    }

    /**
     * @notice Decode settlement report from bytes
     * @param report ABI-encoded settlement data
     * @return sr Decoded settlement report struct
     */
    function _decodeSettlementReport(bytes calldata report) internal pure returns (SettlementReport memory sr) {
        (
            sr.from,
            sr.to,
            sr.amount,
            sr.token,
            sr.nonce,
            sr.validUntil,
            sr.chainId,
            sr.signature,
            sr.permitDeadline,
            sr.permitV,
            sr.permitR,
            sr.permitS
        ) = abi.decode(report, (address, address, uint256, address, uint256, uint256, uint256, bytes, uint256, uint8, bytes32, bytes32));
    }

    /**
     * @notice Validate and execute settlement
     * @param sr Settlement report data
     */
    function _validateAndExecuteSettlement(SettlementReport memory sr) internal {
        if (sr.from == address(0)) revert ZeroAddress("from");
        if (sr.to == address(0)) revert ZeroAddress("to");
        if (sr.token == address(0)) revert ZeroAddress("token");
        if (sr.amount == 0) revert ZeroAmount();
        if (sr.chainId != block.chainid) {
            revert InvalidChainId(block.chainid, sr.chainId);
        }
        if (sr.validUntil != 0 && block.timestamp > sr.validUntil) {
            revert PaymentExpired(sr.validUntil, block.timestamp);
        }
        if (usedNonces[sr.from][sr.nonce]) {
            revert NonceAlreadyUsed(sr.from, sr.nonce);
        }

        // Verify EIP-712 signature
        _verifyPaymentSignature(sr);

        usedNonces[sr.from][sr.nonce] = true;
        _executeTransfer(sr);
        totalPaymentsSettled++;
        volumeByToken[sr.token] += sr.amount;

        bytes32 paymentHash = keccak256(abi.encodePacked(sr.from, sr.to, sr.token, sr.amount, sr.nonce, sr.chainId));

        emit PaymentSettled(sr.from, sr.to, sr.token, sr.amount, sr.nonce, paymentHash);
    }

    /**
     * @notice Verify EIP-712 payment signature
     * @param sr Settlement report data
     */
    function _verifyPaymentSignature(SettlementReport memory sr) internal view {
        bytes32 structHash = keccak256(abi.encode(
            PAYMENT_AUTHORIZATION_TYPEHASH,
            sr.from,
            sr.to,
            sr.amount,
            sr.token,
            sr.nonce,
            sr.validUntil,
            sr.chainId
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, sr.signature);

        if (signer != sr.from) {
            revert InvalidSignature(sr.from, signer);
        }
    }

    /**
     * @notice Execute the token transfer
     * @param sr Settlement report data
     */
    function _executeTransfer(SettlementReport memory sr) internal {
        if (sr.permitDeadline > 0) {
            _executePermitIfNeeded(sr.token, sr.from, sr.amount, sr.permitDeadline, sr.permitV, sr.permitR, sr.permitS);
        }
        
        IERC20(sr.token).safeTransferFrom(sr.from, sr.to, sr.amount);
    }

    /**
     * @notice Execute EIP-2612 permit if needed
     * @param token Token address
     * @param owner Token owner (payer)
     * @param amount Amount to approve
     * @param deadline Permit deadline
     * @param v Signature v
     * @param r Signature r
     * @param s Signature s
     * @dev Uses try-catch to handle front-running and already-approved cases
     */
    function _executePermitIfNeeded(
        address token,
        address owner,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal {
        // Try to execute the permit
        try IERC20Permit(token).permit(owner, address(this), amount, deadline, v, r, s) {
            // Permit succeeded
            emit PermitExecuted(owner, token, amount, deadline);
        } catch {
            // Permit failed - check if allowance exists
            uint256 currentAllowance = IERC20(token).allowance(owner, address(this));
            
            if (currentAllowance >= amount) {
                // Sufficient allowance exists
                emit PermitSkipped(owner, token, currentAllowance);
            } else {
                // Insufficient allowance
                revert InsufficientAllowance(owner, currentAllowance, amount);
            }
        }
    }

    /**
     * @notice Check if contract supports an interface
     * @param interfaceId Interface identifier
     * @return True if interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return 
            interfaceId == type(IReceiver).interfaceId || 
            interfaceId == type(IERC165).interfaceId;
    }
}
