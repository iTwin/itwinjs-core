/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @public */
export interface ProgressInfo {
  percent?: number;
  total?: number;
  loaded: number;
}

/** @public */
export type ProgressCallback = (progress: ProgressInfo) => void;
