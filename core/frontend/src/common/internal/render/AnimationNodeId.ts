/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

/** Special values of [[GraphicBranch.animationNodeId]].
 * All other values refer to an [ElementTimeline.batchId]($common) that applies a transform to the graphics in the branch.
 * @internal
 */
export enum AnimationNodeId {
  Untransformed = 0xffffffff,
}
