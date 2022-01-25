/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ClipVector } from "@itwin/core-geometry";

/** An opaque representation of a clip volume applied to geometry within a [[Viewport]].
 * A RenderClipVolume is created from a [[ClipVector]] and takes ownership of that ClipVector, expecting that it will not be modified while the RenderClipVolume still references it.
 * @see [[RenderSystem.createClipVolume]] to create a clip volume.
 * @public
 */
export abstract class RenderClipVolume {
  /** The ClipVector from which this volume was created. It must not be modified. */
  public readonly clipVector: ClipVector;

  protected constructor(clipVector: ClipVector) {
    this.clipVector = clipVector;
  }
}
