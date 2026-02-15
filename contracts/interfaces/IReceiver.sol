// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title IReceiver
 * @notice Interface for contracts that receive reports from KeystoneForwarder
 * @dev This is the Chainlink CRE IReceiver interface that consumer contracts must implement
 */
interface IReceiver is IERC165 {
    /**
     * @notice Called by the KeystoneForwarder when a workflow submits a report
     * @param metadata Encoded metadata containing workflowId, workflowName, and workflowOwner
     * @param report The ABI-encoded report data from the workflow
     */
    function onReport(bytes calldata metadata, bytes calldata report) external;
}
