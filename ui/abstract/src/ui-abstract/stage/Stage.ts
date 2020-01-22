
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Stage
 */

/** Standard stage uses. Allows plugin to target ui item to include on a stage without
 *  knowing the stage name defined in the host application.
 * @alpha
 */
export enum StageUsage {
  Private = "Private",
  General = "General",
  Redline = "Redline",
}
