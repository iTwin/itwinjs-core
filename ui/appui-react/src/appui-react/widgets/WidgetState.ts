/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { WidgetState as UIA_WidgetState } from "@itwin/appui-abstract";

/** Widget state enum.
 * @public
 */
export type WidgetState = UIA_WidgetState; // eslint-disable-line deprecation/deprecation

/** Widget state enum.
 * @public
 */
export const WidgetState = UIA_WidgetState; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation
