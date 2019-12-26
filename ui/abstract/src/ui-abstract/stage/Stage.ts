
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Stage */

/** Standard stage uses. Allows plugin to target ui item to include on a stage without
 *  knowing the stage name defined in the host application.
 * @alpha
 */
export enum StageUsage {
  Private = "Private",
  General = "General",
  Redline = "Redline",
}
