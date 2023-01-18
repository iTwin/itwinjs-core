/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import { StageUsage as UIA_StageUsage } from "@itwin/appui-abstract";

/** Standard stage uses. Allows extension to target ui item to include on a stage without
 * knowing the stage name defined in the host application.
 * @beta
 */
export type StageUsage = UIA_StageUsage; // eslint-disable-line deprecation/deprecation

/** Standard stage uses. Allows extension to target ui item to include on a stage without
 * knowing the stage name defined in the host application.
 * @beta
 */
export const StageUsage = UIA_StageUsage; // eslint-disable-line @typescript-eslint/no-redeclare, deprecation/deprecation
