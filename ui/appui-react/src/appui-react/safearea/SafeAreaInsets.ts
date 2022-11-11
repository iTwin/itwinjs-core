/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { SafeAreaInsets as LayoutSafeAreaInsets } from "@itwin/appui-layout-react";

// Re-export `SafeAreaInsets` enum in a non-breaking way to deprecate it in an `appui-layout-react` package.

/** Describes available safe area insets.
 * @beta
 */
export type SafeAreaInsets = LayoutSafeAreaInsets;

/** Describes available safe area insets.
 * @beta
 */
export const SafeAreaInsets = LayoutSafeAreaInsets;
