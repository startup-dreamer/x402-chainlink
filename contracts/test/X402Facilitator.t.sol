// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test, console2} from "forge-std/Test.sol";
import {X402Facilitator} from "../src/X402Facilitator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MockERC20
 * @notice Simple ERC20 token for testing (without permit)
 */
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC-like decimals
    }
}

/**
 * @title MockERC20Permit
 * @notice ERC20 token with EIP-2612 permit support for testing
 */
contract MockERC20Permit is ERC20Permit {
    constructor(string memory name, string memory symbol) 
        ERC20(name, symbol) 
        ERC20Permit(name) 
    {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC-like decimals
    }
}

/**
 * @title MockForwarder
 * @notice Mock KeystoneForwarder for testing
 */
contract MockForwarder {
    function forward(address payable target, bytes calldata metadata, bytes calldata report) external {
        X402Facilitator(target).onReport(metadata, report);
    }
}

/**
 * @title X402FacilitatorTest
 * @notice Foundry tests for X402Facilitator contract
 */
contract X402FacilitatorTest is Test {
    X402Facilitator public facilitator;
    MockForwarder public forwarder;
    MockERC20 public usdc;
    MockERC20Permit public usdcPermit;
    
    // Test accounts
    address public owner;
    uint256 public ownerKey;
    address public payer;
    uint256 public payerKey;
    address public recipient;
    uint256 public recipientKey;
    
    // EIP-712 type hashes
    bytes32 constant PAYMENT_AUTHORIZATION_TYPEHASH = keccak256(
        "PaymentAuthorization(address from,address to,uint256 amount,address token,uint256 nonce,uint256 validUntil,uint256 chainId)"
    );
    
    bytes32 constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );
    
    function setUp() public {
        // Create test accounts
        (owner, ownerKey) = makeAddrAndKey("owner");
        (payer, payerKey) = makeAddrAndKey("payer");
        (recipient, recipientKey) = makeAddrAndKey("recipient");
        
        vm.startPrank(owner);
        
        // Deploy mock forwarder
        forwarder = new MockForwarder();
        
        // Deploy facilitator with forwarder address
        facilitator = new X402Facilitator(address(forwarder));
        
        // Deploy mock USDC (without permit)
        usdc = new MockERC20("USD Coin", "USDC");
        
        // Deploy mock USDC with permit support
        usdcPermit = new MockERC20Permit("USD Coin", "USDC");
        
        vm.stopPrank();
        
        // Mint tokens to payer for both tokens
        usdc.mint(payer, 1000 * 10**6); // 1000 USDC
        usdcPermit.mint(payer, 1000 * 10**6); // 1000 USDC with permit
        
        // Payer approves facilitator for regular USDC
        vm.prank(payer);
        usdc.approve(address(facilitator), type(uint256).max);
        
        // Note: No approval for usdcPermit - will use permit instead
    }
    
    
    // Deployment Tests
    
    
    function test_deployment() public view {
        assertEq(facilitator.owner(), owner);
        assertEq(facilitator.s_forwarderAddress(), address(forwarder));
    }
    
    function test_revert_zeroForwarder() public {
        vm.expectRevert(abi.encodeWithSelector(X402Facilitator.ZeroAddress.selector, "forwarderAddress"));
        new X402Facilitator(address(0));
    }
    
    
    // Settlement Tests
    
    
    function test_settlePayment_success() public {
        uint256 amount = 100 * 10**6; // 100 USDC
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        
        // Sign payment authorization
        bytes memory signature = _signPaymentAuthorization(
            payer,
            recipient,
            amount,
            address(usdc),
            nonce,
            validUntil,
            chainId,
            payerKey
        );
        
        // Encode report (with no permit data - all zeros)
        bytes memory report = _encodeReport(
            payer,
            recipient,
            amount,
            address(usdc),
            nonce,
            validUntil,
            chainId,
            signature,
            0, 0, bytes32(0), bytes32(0) // No permit
        );
        
        // Check balances before
        uint256 payerBalanceBefore = usdc.balanceOf(payer);
        uint256 recipientBalanceBefore = usdc.balanceOf(recipient);
        
        // Forward report
        forwarder.forward(payable(address(facilitator)), "", report);
        
        // Check balances after
        assertEq(usdc.balanceOf(payer), payerBalanceBefore - amount);
        assertEq(usdc.balanceOf(recipient), recipientBalanceBefore + amount);
        
        // Check nonce is used
        assertTrue(facilitator.isNonceUsed(payer, nonce));
        
        // Check statistics
        assertEq(facilitator.totalPaymentsSettled(), 1);
        assertEq(facilitator.volumeByToken(address(usdc)), amount);
    }
    
    function test_revert_unauthorizedForwarder() public {
        bytes memory report = _encodeReport(
            payer, recipient, 100e6, address(usdc), 1, block.timestamp + 1 hours, block.chainid, "",
            0, 0, bytes32(0), bytes32(0)
        );
        
        // Try to call onReport directly (not from forwarder)
        vm.expectRevert(
            abi.encodeWithSelector(
                X402Facilitator.UnauthorizedForwarder.selector,
                address(this),
                address(forwarder)
            )
        );
        facilitator.onReport("", report);
    }
    
    function test_revert_invalidSignature() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        
        // Sign with wrong key (recipient instead of payer)
        bytes memory signature = _signPaymentAuthorization(
            payer,
            recipient,
            amount,
            address(usdc),
            nonce,
            validUntil,
            chainId,
            recipientKey // Wrong key!
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdc), nonce, validUntil, chainId, signature,
            0, 0, bytes32(0), bytes32(0)
        );
        
        vm.expectRevert();
        forwarder.forward(payable(address(facilitator)), "", report);
    }
    
    function test_revert_nonceReuse() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        
        bytes memory signature = _signPaymentAuthorization(
            payer, recipient, amount, address(usdc), nonce, validUntil, chainId, payerKey
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdc), nonce, validUntil, chainId, signature,
            0, 0, bytes32(0), bytes32(0)
        );
        
        // First settlement succeeds
        forwarder.forward(payable(address(facilitator)), "", report);
        
        // Second settlement with same nonce fails
        vm.expectRevert(
            abi.encodeWithSelector(X402Facilitator.NonceAlreadyUsed.selector, payer, nonce)
        );
        forwarder.forward(payable(address(facilitator)), "", report);
    }
    
    function test_revert_expiredPayment() public {
        // Warp to a reasonable timestamp first (block.timestamp starts at 0 in tests)
        vm.warp(1000000);
        
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp - 1; // Already expired
        uint256 chainId = block.chainid;
        
        bytes memory signature = _signPaymentAuthorization(
            payer, recipient, amount, address(usdc), nonce, validUntil, chainId, payerKey
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdc), nonce, validUntil, chainId, signature,
            0, 0, bytes32(0), bytes32(0)
        );
        
        vm.expectRevert();
        forwarder.forward(payable(address(facilitator)), "", report);
    }
    
    function test_revert_wrongChainId() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 wrongChainId = 999;
        
        bytes memory signature = _signPaymentAuthorization(
            payer, recipient, amount, address(usdc), nonce, validUntil, wrongChainId, payerKey
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdc), nonce, validUntil, wrongChainId, signature,
            0, 0, bytes32(0), bytes32(0)
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(X402Facilitator.InvalidChainId.selector, block.chainid, wrongChainId)
        );
        forwarder.forward(payable(address(facilitator)), "", report);
    }
    
    
    // EIP-2612 Permit Tests
    
    
    function test_settlePayment_withPermit_success() public {
        uint256 amount = 100 * 10**6; // 100 USDC
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        uint256 permitDeadline = block.timestamp + 1 hours;
        
        // Sign payment authorization
        bytes memory signature = _signPaymentAuthorization(
            payer,
            recipient,
            amount,
            address(usdcPermit),
            nonce,
            validUntil,
            chainId,
            payerKey
        );
        
        // Sign permit (EIP-2612)
        (uint8 permitV, bytes32 permitR, bytes32 permitS) = _signPermit(
            payer,
            address(facilitator),
            amount,
            usdcPermit.nonces(payer),
            permitDeadline,
            payerKey
        );
        
        // Encode report with permit data
        bytes memory report = _encodeReport(
            payer,
            recipient,
            amount,
            address(usdcPermit),
            nonce,
            validUntil,
            chainId,
            signature,
            permitDeadline,
            permitV,
            permitR,
            permitS
        );
        
        // Check that payer has no allowance before
        assertEq(usdcPermit.allowance(payer, address(facilitator)), 0);
        
        // Check balances before
        uint256 payerBalanceBefore = usdcPermit.balanceOf(payer);
        uint256 recipientBalanceBefore = usdcPermit.balanceOf(recipient);
        
        // Forward report - permit will be executed first, then transfer
        forwarder.forward(payable(address(facilitator)), "", report);
        
        // Check balances after
        assertEq(usdcPermit.balanceOf(payer), payerBalanceBefore - amount);
        assertEq(usdcPermit.balanceOf(recipient), recipientBalanceBefore + amount);
        
        // Check nonce is used
        assertTrue(facilitator.isNonceUsed(payer, nonce));
    }
    
    function test_settlePayment_permitAlreadyApproved() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        uint256 permitDeadline = block.timestamp + 1 hours;
        
        // Pre-approve the facilitator
        vm.prank(payer);
        usdcPermit.approve(address(facilitator), type(uint256).max);
        
        // Sign payment authorization
        bytes memory signature = _signPaymentAuthorization(
            payer, recipient, amount, address(usdcPermit), nonce, validUntil, chainId, payerKey
        );
        
        // Sign permit with wrong nonce (simulating a front-run scenario)
        // The permit will fail, but the transfer should succeed due to existing allowance
        (uint8 permitV, bytes32 permitR, bytes32 permitS) = _signPermit(
            payer,
            address(facilitator),
            amount,
            999, // Wrong nonce
            permitDeadline,
            payerKey
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdcPermit), nonce, validUntil, chainId, signature,
            permitDeadline, permitV, permitR, permitS
        );
        
        uint256 payerBalanceBefore = usdcPermit.balanceOf(payer);
        uint256 recipientBalanceBefore = usdcPermit.balanceOf(recipient);
        
        // Should succeed - permit fails but existing allowance is sufficient
        forwarder.forward(payable(address(facilitator)), "", report);
        
        assertEq(usdcPermit.balanceOf(payer), payerBalanceBefore - amount);
        assertEq(usdcPermit.balanceOf(recipient), recipientBalanceBefore + amount);
    }
    
    function test_revert_permitFailedNoAllowance() public {
        uint256 amount = 100 * 10**6;
        uint256 nonce = 1;
        uint256 validUntil = block.timestamp + 1 hours;
        uint256 chainId = block.chainid;
        uint256 permitDeadline = block.timestamp + 1 hours;
        
        // Sign payment authorization
        bytes memory signature = _signPaymentAuthorization(
            payer, recipient, amount, address(usdcPermit), nonce, validUntil, chainId, payerKey
        );
        
        // Sign permit with wrong nonce (will fail)
        (uint8 permitV, bytes32 permitR, bytes32 permitS) = _signPermit(
            payer,
            address(facilitator),
            amount,
            999, // Wrong nonce - permit will fail
            permitDeadline,
            payerKey
        );
        
        bytes memory report = _encodeReport(
            payer, recipient, amount, address(usdcPermit), nonce, validUntil, chainId, signature,
            permitDeadline, permitV, permitR, permitS
        );
        
        // Should revert - permit fails and no existing allowance
        vm.expectRevert(
            abi.encodeWithSelector(X402Facilitator.InsufficientAllowance.selector, payer, 0, amount)
        );
        forwarder.forward(payable(address(facilitator)), "", report);
    }
    
    
    // Admin Tests
    
    
    function test_setForwarderAddress() public {
        address newForwarder = makeAddr("newForwarder");
        
        vm.prank(owner);
        facilitator.setForwarderAddress(newForwarder);
        
        assertEq(facilitator.s_forwarderAddress(), newForwarder);
    }
    
    function test_setForwarderAddress_onlyOwner() public {
        vm.prank(payer);
        vm.expectRevert();
        facilitator.setForwarderAddress(makeAddr("newForwarder"));
    }
    
    
    // Helper Functions
    
    
    /**
     * @notice Encode a settlement report with permit data
     */
    function _encodeReport(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 nonce,
        uint256 validUntil,
        uint256 chainId,
        bytes memory signature,
        uint256 permitDeadline,
        uint8 permitV,
        bytes32 permitR,
        bytes32 permitS
    ) internal pure returns (bytes memory) {
        return abi.encode(
            from,
            to,
            amount,
            token,
            nonce,
            validUntil,
            chainId,
            signature,
            permitDeadline,
            permitV,
            permitR,
            permitS
        );
    }
    
    /**
     * @notice Sign a payment authorization (EIP-712)
     */
    function _signPaymentAuthorization(
        address from,
        address to,
        uint256 amount,
        address token,
        uint256 nonce,
        uint256 validUntil,
        uint256 chainId,
        uint256 privateKey
    ) internal view returns (bytes memory) {
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
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            facilitator.domainSeparator(),
            structHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
    
    /**
     * @notice Sign a permit (EIP-2612)
     */
    function _signPermit(
        address owner_,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline,
        uint256 privateKey
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 structHash = keccak256(abi.encode(
            PERMIT_TYPEHASH,
            owner_,
            spender,
            value,
            nonce,
            deadline
        ));
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            usdcPermit.DOMAIN_SEPARATOR(),
            structHash
        ));
        
        (v, r, s) = vm.sign(privateKey, digest);
    }
}
