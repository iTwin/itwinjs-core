/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module LocatingElements */
import { Viewport } from "./Viewport";
import { Range3d, ClipVector } from "@bentley/geometry-core";

/**
 * The fence clip mode controls element acceptance criteria.
 */
export const enum FenceClipMode {
  /** Inclusion of inside/overlapping elements controlled by overlap mode. No clipping of elements satisfying the fence criteria. */
  None = 0,
  /** Include elements that overlap the fence. Tools will modify the original element. */
  Original = 1,
  /** Include elements that overlap the fence. Tools will not modify the original element. */
  Copy = 3,
}

/**
 * Class for finding elements that are inside or overlap a volume defined by an
 * extrusion of a planar region profile.
 */
export class FenceParams {
  public overlapMode = false;
  public onTolerance = .25;
  public viewport?: Viewport;
  public clipMode = FenceClipMode.None;
  public clip?: ClipVector;
  public hasOverlaps = false;
  public readonly fenceRangeNPC = new Range3d();
}
