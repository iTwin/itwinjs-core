/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Barrel file for all extension related files.

/**
 * The Extension framework is made up of multiple pieces:
 *
 * - Extension API
 *    - The Extension API defines all of the types and API that can be used by an Extension.
 * - Extension Impl
 *    - The current implementation of the Extension API
 * - Extension Admin
 *    - Handles loading and managing Extensions
 * - Extension Hooks
 *    - Defines the contribution points for Extensions
 */

export * from "./Extension";
export * from "./ExtensionAdmin";
export * from "./ExtensionImpl";
export * from "./ExtensionLoader";
export * from "./ExtensionHost";
import "./ExtensionRuntime";
