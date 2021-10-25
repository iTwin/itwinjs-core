/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Barrel file for all extension related files.

/**
 * The Extension framework is made up of multiple pieces:
 *
 * - Extension Impl
 * - Extension API
 *    - The Extension API defines all of the types and API that can be used by an Extension.
 * - Extension Admin loading
 *    - Handles the
 * - Extension Hooks
 *    - Defines the
 */

export * from "./Extension";
export * from "./ExtensionAdmin";
export * from "./ExtensionImpl";
export * from "./ExtensionLoader";
export * from "./ExtensionHost";
import "./ExtensionRuntime";
