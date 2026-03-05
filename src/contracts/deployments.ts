/**
 * Deployed contract addresses for the x402 payment protocol.
 *
 * These are the canonical on-chain deployments — consuming apps can import
 * these constants directly rather than configuring addresses via environment
 * variables.
 */

import type { EVMNetworkId } from '../types/index.js';

export interface FacilitatorDeployment {
  /** Deployed contract address */
  address: `0x${string}`;
  /** EVM chain ID */
  chainId: number;
  /** CAIP-2 network identifier */
  network: EVMNetworkId;
}

/**
 * Known deployments of the X402Facilitator contract, keyed by CAIP-2 network.
 *
 * @example
 * ```typescript
 * import { FACILITATOR_DEPLOYMENTS } from 'x402-chainlink';
 *
 * const deployment = FACILITATOR_DEPLOYMENTS['eip155:84532'];
 * console.log(deployment.address); // 0xea52C55099A65542a785280A9D47CC5A769DE7AB
 * console.log(deployment.chainId); // 84532
 * ```
 */
export const FACILITATOR_DEPLOYMENTS: Partial<
  Record<EVMNetworkId, FacilitatorDeployment>
> = {
  'eip155:84532': {
    address: '0xea52C55099A65542a785280A9D47CC5A769DE7AB',
    chainId: 84532,
    network: 'eip155:84532',
  },
} as const;

/**
 * Look up the facilitator deployment for a given network.
 *
 * @param network - CAIP-2 network identifier (e.g. `"eip155:84532"`)
 * @returns Deployment info, or `undefined` if not yet deployed on that network.
 *
 * @example
 * ```typescript
 * const dep = getFacilitatorDeployment('eip155:84532');
 * if (dep) {
 *   console.log(dep.address, dep.chainId);
 * }
 * ```
 */
export function getFacilitatorDeployment(
  network: EVMNetworkId
): FacilitatorDeployment | undefined {
  return FACILITATOR_DEPLOYMENTS[network];
}
