/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Carries information in a GraphicBranchOptions about a GraphicBranch produced by drawing one view into the context of another. */
export interface GraphicBranchFrustum {
  is3d: boolean;
  scale: {
    x: number;
    y: number;
  };
}

