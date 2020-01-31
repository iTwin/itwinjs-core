/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Clipper } from "./ClipUtils";
import { Range1dArray } from "../numerics/Range1dArray";
import { BooleanClipNode } from "./BooleanClipNode";

/** A BooleanClipFactory is a factory to create objects that implement interior nodes of a tree of boolean clip operations.
 * * The static (factory) methods create specific clip actions:
 *   * Union
 *   * Intersection
 *   * Parity
 *   * Difference
 * * Each construction has a `keepInside` flag that optionally negates the initial result of the parity, intersection, parity, or difference:
 *   * if `keepInside === true`, accept the "inside" of the initial result
 *   * if `keepInside === false`, accept the "outside"  of the initial result
 * @public
 */
export class BooleanClipFactory {
  /**
   * Create a boolean clipper which performs a union over its children
   * * if `keepInside === true`, accept the "inside" of the union result
   * * if `keepInside === false`, accept the "outside" of the union result
   * @param clippers clip objects to capture
   * @param keepInside flag to select results inside or outside the clippers.
   */
  public static createCaptureUnion(clippers: Clipper | Clipper[], keepInside: boolean): Clipper {
    const result = new BooleanClipNode(BooleanClipNode.isPointOnOrInsideOR, Range1dArray.unionSorted, keepInside);
    result.captureChild(clippers);
    return result;
  }
  /**
   * Create a boolean clipper which performs an intersection over its children
   * * if `keepInside === true`, accept the "inside" of the intersection result
   * * if `keepInside === false`, accept the "outside" of the intersection result
   * @param clippers clip objects to capture
   * @param keepInside flag to select results inside or outside the clippers.
   */
  public static createCaptureIntersection(clippers: Clipper | Clipper[], keepInside: boolean): Clipper {
    const result = new BooleanClipNode(BooleanClipNode.isPointOnOrInsideAND, Range1dArray.intersectSorted, keepInside);
    result.captureChild(clippers);
    return result;
  }
  /**
   * Create a boolean clipper which performs a parity over its children
   * * if `keepInside === true`, accept the "inside" of the parity result
   * * if `keepInside === false`, accept the "outside" of the parity result
   * @param clippers clip objects to capture
   * @param keepInside flag to select results inside or outside the clippers.
   */
  public static createCaptureParity(clippers: Clipper | Clipper[], keepInside: boolean): Clipper {
    const result = new BooleanClipNode(BooleanClipNode.isPointOnOrInsideXOR, Range1dArray.paritySorted, keepInside);
    result.captureChild(clippers);
    return result;
  }
  /**
   * Create a boolean clipper which performs a difference operation for points "inside `primaryClipper`" and "outside `excludedClipper`"
   * * if `keepInside === true`, accept the "inside" of the difference
   * * if `keepInside === false`, accept the "outside" of the difference
   * @param clippers clip objects to capture
   * @param keepInside flag to select results inside or outside the clippers.
   */
  public static createCaptureDifference(primaryClipper: Clipper, excludedClip: Clipper, keepInside: boolean): Clipper {
    const mask = this.createCaptureUnion(excludedClip, false);
    return this.createCaptureIntersection([primaryClipper, mask], keepInside);
  }
}
