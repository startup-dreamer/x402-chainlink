// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console2} from "forge-std/Script.sol";
import {X402Facilitator} from "../src/X402Facilitator.sol";

/**
 * @title DeployX402Facilitator
 * @notice Deployment script for the X402Facilitator contract
 * 
 * Usage:
 *   # Deploy to Base Sepolia (simulation mode)
 *   forge script scripts/foundry/DeployX402Facilitator.s.sol:DeployX402Facilitator \
 *     --rpc-url base_sepolia \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 * 
 *   # Deploy to Base Mainnet (production mode)
 *   forge script scripts/foundry/DeployX402Facilitator.s.sol:DeployX402Facilitator \
 *     --rpc-url base_mainnet \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployX402Facilitator is Script {
    
    // Forwarder Addresses
    
    
    // MockForwarder addresses (for simulation)
    address constant MOCK_FORWARDER_BASE_SEPOLIA = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;
    address constant MOCK_FORWARDER_ETH_SEPOLIA = 0x15fC6ae953E024d975e77382eEeC56A9101f9F88;
    
    // KeystoneForwarder addresses (for production)
    address constant KEYSTONE_FORWARDER_BASE_SEPOLIA = 0x1A1C2103a4BcB04f548e9525D4cc33aC47f1ec44;
    address constant KEYSTONE_FORWARDER_ETH_SEPOLIA = 0xF8344CFd5c43616a4366C34E3EEE75af79a74482;
    
    // Mainnet KeystoneForwarder addresses (to be confirmed)
    // These are placeholders - verify with Chainlink documentation before mainnet deployment
    address constant KEYSTONE_FORWARDER_BASE_MAINNET = address(0);
    address constant KEYSTONE_FORWARDER_ETH_MAINNET = address(0);
    
    
    // Deployment
    
    
    function run() public {
        // Get deployment mode from environment
        bool useKeystone = vm.envOr("USE_KEYSTONE", false);
        address forwarderOverride = vm.envOr("FORWARDER_ADDRESS", address(0));
        
        // Determine forwarder address
        address forwarderAddress;
        
        if (forwarderOverride != address(0)) {
            // Use override if provided
            forwarderAddress = forwarderOverride;
            console2.log("Using forwarder override:", forwarderAddress);
        } else if (useKeystone) {
            // Use KeystoneForwarder for production
            forwarderAddress = _getKeystoneForwarder();
            console2.log("Using KeystoneForwarder:", forwarderAddress);
        } else {
            // Use MockForwarder for simulation
            forwarderAddress = _getMockForwarder();
            console2.log("Using MockForwarder:", forwarderAddress);
        }
        
        require(forwarderAddress != address(0), "Forwarder address not set for this chain");
        
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("Deploying X402Facilitator...");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Forwarder:", forwarderAddress);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy the contract
        X402Facilitator facilitator = new X402Facilitator(forwarderAddress);
        
        vm.stopBroadcast();
        
        // Log deployment details
        console2.log("");
        console2.log("==============================================");
        console2.log("X402Facilitator deployed successfully!");
        console2.log("==============================================");
        console2.log("Contract address:", address(facilitator));
        console2.log("Owner:", facilitator.owner());
        console2.log("Forwarder:", facilitator.s_forwarderAddress());
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Update x402-workflow/config.staging.json with contract address");
        console2.log("2. Users must approve this contract to spend their tokens:");
        console2.log("   token.approve(", address(facilitator), ", amount)");
        console2.log("3. Deploy and register CRE workflow");
        console2.log("");
    }
    
    
    // Internal Functions
    
    
    function _getMockForwarder() internal view returns (address) {
        uint256 chainId = block.chainid;
        
        if (chainId == 84532) {
            return MOCK_FORWARDER_BASE_SEPOLIA;
        } else if (chainId == 11155111) {
            return MOCK_FORWARDER_ETH_SEPOLIA;
        }
        
        return address(0);
    }
    
    function _getKeystoneForwarder() internal view returns (address) {
        uint256 chainId = block.chainid;
        
        if (chainId == 84532) {
            return KEYSTONE_FORWARDER_BASE_SEPOLIA;
        } else if (chainId == 11155111) {
            return KEYSTONE_FORWARDER_ETH_SEPOLIA;
        } else if (chainId == 8453) {
            return KEYSTONE_FORWARDER_BASE_MAINNET;
        } else if (chainId == 1) {
            return KEYSTONE_FORWARDER_ETH_MAINNET;
        }
        
        return address(0);
    }
}

/**
 * @title DeployX402FacilitatorToAnvil
 * @notice Deploy to local Anvil for testing
 * 
 * Usage:
 *   # Start Anvil first
 *   anvil
 * 
 *   # In another terminal
 *   forge script scripts/foundry/DeployX402Facilitator.s.sol:DeployX402FacilitatorToAnvil \
 *     --rpc-url anvil \
 *     --broadcast \
 *     -vvvv
 */
contract DeployX402FacilitatorToAnvil is Script {
    // Default Anvil private key (account 0)
    uint256 constant ANVIL_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    
    function run() public {
        // Use first Anvil account as both deployer and mock forwarder
        address deployer = vm.addr(ANVIL_PRIVATE_KEY);
        address mockForwarder = deployer; // For local testing, deployer can be forwarder
        
        console2.log("Deploying to local Anvil...");
        console2.log("Deployer:", deployer);
        console2.log("Mock Forwarder:", mockForwarder);
        
        vm.startBroadcast(ANVIL_PRIVATE_KEY);
        
        X402Facilitator facilitator = new X402Facilitator(mockForwarder);
        
        vm.stopBroadcast();
        
        console2.log("");
        console2.log("X402Facilitator deployed to:", address(facilitator));
        console2.log("");
        console2.log("For local testing, call onReport directly:");
        console2.log("  facilitator.onReport(metadata, report)");
    }
}
