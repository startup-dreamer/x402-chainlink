/**
 * Extensions system module
 * Spec compliance: x402 v2 - Extensions System
 * @module extensions
 */

export type {
  Extension,
  IExtensionRegistry,
  ValidationResult,
  JSONSchema,
  CreateExtensionDataOptions,
  ExtensionData,
} from './types.js';
export {
  ExtensionRegistry,
  createExtensionRegistry,
  globalRegistry,
} from './registry.js';
export {
  createExtensionData,
  getExtensionInfo,
  hasExtension,
  getExtensionNames,
  mergeExtensions,
  filterRegisteredExtensions,
  validateExtensions,
  defineExtension,
} from './utils.js';
