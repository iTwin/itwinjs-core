/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { BadgeType as AbstractBadgeType } from "@itwin/appui-abstract";

// Re-export `BadgeType` enum in a non-breaking way to deprecate it in an `appui-abstract` package.

/** Specifies type of badge, if any, that should be overlaid on UI component.
 * @public
 */
export type BadgeType = AbstractBadgeType; // eslint-disable-line deprecation/deprecation

/** Specifies type of badge, if any, that should be overlaid on UI component.
 * @public
 */
export const BadgeType = AbstractBadgeType; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation
