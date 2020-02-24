/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { IDisposable } from "@bentley/bentleyjs-core";
import { ClipVector } from "@bentley/geometry-core";
import { RenderMemory } from "./RenderMemory";

/** Describes the type of a RenderClipVolume.
 * @beta
 */
export const enum ClippingType { // tslint:disable-line:no-const-enum
  /** No clip volume. */
  None,
  /** A 2d mask which excludes geometry obscured by the mask. */
  Mask,
  /** A 3d set of convex clipping planes which excludes geometry outside of the planes. */
  Planes,
}

/** An opaque representation of a clip volume applied to geometry within a [[Viewport]].
 * A RenderClipVolume is created from a [[ClipVector]] and takes ownership of that ClipVector, expecting that it will not be modified while the RenderClipVolume still references it.
 * @see [System.createClipVolume]
 * @beta
 */
export abstract class RenderClipVolume implements IDisposable /* , RenderMemory.Consumer */ {
  /** The ClipVector from which this volume was created. It must not be modified. */
  public readonly clipVector: ClipVector;

  protected constructor(clipVector: ClipVector) {
    this.clipVector = clipVector;
  }

  /** Returns the type of this clipping volume. */
  public abstract get type(): ClippingType;

  /** Disposes of any WebGL resources owned by this volume. Must be invoked when finished with the clip volume object to prevent memory leaks. */
  public abstract dispose(): void;

  /** @internal */
  public abstract collectStatistics(stats: RenderMemory.Statistics): void;
}
