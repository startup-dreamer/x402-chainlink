// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {X402Facilitator} from "../src/X402Facilitator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title VerifyDeployment
 * @notice Script to verify X402Facilitator deployment and configuration
 * 
 * Usage:
 *   FACILITATOR_ADDRESS=0x... forge script scripts/foundry/VerifyDeployment.s.sol:VerifyDeployment \
 *     --rpc-url base_sepolia \
 *     -vvvv
 */
contract VerifyDeployment is Script {
    function run() public view {
        address facilitatorAddress = vm.envAddress("FACILITATOR_ADDRESS");
        
        console2.log("==============================================");
        console2.log("Verifying X402Facilitator Deployment");
        console2.log("==============================================");
        console2.log("Contract:", facilitatorAddress);
        console2.log("Chain ID:", block.chainid);
        console2.log("");
        
        X402Facilitator facilitator = X402Facilitator(payable(facilitatorAddress));
        
        // Check basic properties
        console2.log("Owner:", facilitator.owner());
        console2.log("Forwarder:", facilitator.s_forwarderAddress());
        console2.log("Expected Workflow ID:", vm.toString(facilitator.s_expectedWorkflowId()));
        console2.log("Expected Author:", facilitator.s_expectedAuthor());
        console2.log("");
        
        // Check EIP-712 configuration
        console2.log("EIP-712 Name:", facilitator.EIP712_NAME());
        console2.log("EIP-712 Version:", facilitator.EIP712_VERSION());
        console2.log("Domain Separator:", vm.toString(facilitator.domainSeparator()));
        console2.log("");
        
        // Check statistics
        console2.log("Total Payments Settled:", facilitator.totalPaymentsSettled());
        console2.log("");
        
        // Check interface support
        // IReceiver interface ID: 0x3d3ac1b5
        // ERC165 interface ID: 0x01ffc9a7
        bool supportsReceiver = facilitator.supportsInterface(bytes4(0x3d3ac1b5)); // IReceiver
        bool supportsERC165 = facilitator.supportsInterface(bytes4(0x01ffc9a7)); // ERC165
        
        console2.log("Supports IReceiver:", supportsReceiver);
        console2.log("Supports ERC165:", supportsERC165);
        console2.log("");
        
        console2.log("==============================================");
        console2.log("Deployment verification complete!");
        console2.log("==============================================");
    }
}

/**
 * @title TestSettlement
 * @notice Script to test settlement with a mock payment
 * 
 * Usage:
 *   FACILITATOR_ADDRESS=0x... TOKEN_ADDRESS=0x... \
 *   forge script scripts/foundry/VerifyDeployment.s.sol:TestSettlement \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     -vvvv
 */
contract TestSettlement is Script {
    function run() public {
        address facilitatorAddress = vm.envAddress("FACILITATOR_ADDRESS");
        address tokenAddress = vm.envOr("TOKEN_ADDRESS", address(0));
        
        uint256 testPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address tester = vm.addr(testPrivateKey);
        
        console2.log("==============================================");
        console2.log("Testing X402Facilitator Settlement");
        console2.log("==============================================");
        console2.log("Facilitator:", facilitatorAddress);
        console2.log("Tester:", tester);
        console2.log("Token:", tokenAddress);
        console2.log("");
        
        X402Facilitator facilitator = X402Facilitator(payable(facilitatorAddress));
        
        // Verify tester has approved the facilitator
        if (tokenAddress != address(0)) {
            IERC20 token = IERC20(tokenAddress);
            uint256 allowance = token.allowance(tester, facilitatorAddress);
            uint256 balance = token.balanceOf(tester);
            
            console2.log("Tester balance:", balance);
            console2.log("Tester allowance:", allowance);
            
            if (allowance == 0) {
                console2.log("");
                console2.log("WARNING: Tester has not approved the facilitator!");
                console2.log("Run: token.approve(facilitatorAddress, amount)");
                return;
            }
        }
        
        console2.log("");
        console2.log("Settlement test requires:");
        console2.log("1. Deploy and register CRE workflow");
        console2.log("2. Trigger workflow with payment authorization");
        console2.log("3. KeystoneForwarder calls onReport()");
        console2.log("");
        console2.log("For local testing, use DeployX402FacilitatorToAnvil");
        console2.log("and call onReport directly.");
    }
}
