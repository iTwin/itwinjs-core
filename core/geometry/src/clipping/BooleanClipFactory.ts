/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { BooleanClipNodeIntersection, BooleanClipNodeParity, BooleanClipNodeUnion } from "./BooleanClipNode";
import { ClipPlane } from "./ClipPlane";
import { Clipper, ClipUtilities } from "./ClipUtils";
import { ConvexClipPlaneSet } from "./ConvexClipPlaneSet";
import { UnionOfConvexClipPlaneSets } from "./UnionOfConvexClipPlaneSets";

/** A BooleanClipFactory is a factory to create objects that implement interior nodes of a tree of boolean clip operations.
 * * These methods create specific clip tree types:
 *   * Union
 *   * Intersection
 *   * Parity
 *   * Difference
 * * Each construction has a `keepInside` flag that optionally negates the initial result of the parity, intersection, parity, or difference:
 *   * if `keepInside === true`, accept the "inside" of the initial result
 *   * if `keepInside === false`, accept the "outside"  of the initial result
 * * These methods create various other specialized clippers
 *   *
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
    const result = new BooleanClipNodeUnion(keepInside);
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
    const result = new BooleanClipNodeIntersection(keepInside);
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
    const result = new BooleanClipNodeParity(keepInside);
    result.captureChild(clippers);
    return result;
  }
  /**
   * Create a boolean clipper which performs a difference operation for points "inside `primaryClipper`" and "outside `excludedClipper`"
   * * if `keepInside === true`, accept the "inside" of the difference
   * * if `keepInside === false`, accept the "outside" of the difference
   * @param primaryClipper any clip object whose output is treated as positive
   * @param excludeClip any clipper whose output is treated as negative.
   * @param keepInside flag to select results inside or outside the initial `primary minus excludeClipper` clippers.
   */
  public static createCaptureDifference(primaryClipper: Clipper, excludedClipper: Clipper, keepInside: boolean): Clipper {
    const mask = this.createCaptureUnion(excludedClipper, false);
    return this.createCaptureIntersection([primaryClipper, mask], keepInside);
  }
  /**
   * Create a boolean clipper which performs the reverse of that of `primaryClipper`
   * @param primaryClipper clip objects to capture
   * @param keepInside flag to select results inside or outside the clippers.
   */
  public static createCaptureClipOutside(primaryClipper: Clipper): Clipper {
    return this.createCaptureUnion([primaryClipper], false);
  }

  /**
   * convert `source` to an array of clipper objects.
   * * ANY TYPE OF Clipper is accepted.
   * * REMARK: This is normally called only from the primary public method `parseToClipper`.
   * @param source
   * @param internal
   */
  public static parseToClipperArray(source: any): Clipper[] | undefined {
    if (Array.isArray(source)) {
      const clippers = [];
      for (const c of source) {
        const c1 = this.parseToClipper(c);
        if (!c1)
          return undefined;
        clippers.push(c1);
      }
      if (clippers.length === 0)
        return undefined;
      return clippers;
    } else {
      // accept singleton to singleton array
      const c = this.parseToClipper(source);
      if (c)
        return [c];
    }
    return undefined;
  }
  /**
   * look for content that represents a clipper.
   * * Possible outputs are
   *   * `ClipPlane`
   *   * `ConvexClipPlaneSet`
   *   * `UnionOfConvexClipPlaneSets`
   *   * One of the `ClipBoolean` derived classes
   *     * `ClipBooleanXOR`
   *     * `ClipBooleanOR`
   *     * `ClipBooleanAND`
   * @param source json object
   * @public
   */
  public static parseToClipper(source?: object): Clipper | undefined {
    if (!source)
      return undefined;

    if (source.hasOwnProperty("normal") && source.hasOwnProperty("dist")) {
      return ClipPlane.fromJSON(source);
    } else if (Array.isArray(source)) {
      const clippers: Clipper[] = [];
      let numPlanes = 0;
      let numConvexSets = 0;
      for (const c of source) {
        const c1 = this.parseToClipper(c);
        if (!c1)
          return undefined;
        clippers.push(c1);
        if (c1 instanceof ClipPlane)
          numPlanes++;
        else if (c1 instanceof ConvexClipPlaneSet)
          numConvexSets++;
        else
          return undefined;
      }
      if (clippers.length === 0)
        return undefined;
      if (numPlanes === source.length) {
        // array of planes is a convex clip plane set.
        return ConvexClipPlaneSet.createPlanes(clippers as ClipPlane[]);
      } else if (numConvexSets === source.length) {
        return UnionOfConvexClipPlaneSets.createConvexSets(clippers as ConvexClipPlaneSet[]);
      }
      // array of mixed types should not occur.  fall out to undefined.
    } else if (source.hasOwnProperty("OR")) {
      const clippers = this.parseToClipperArray((source as any).OR);
      if (clippers)
        return this.createCaptureUnion(clippers, true);
    } else if (source.hasOwnProperty("NOR")) {
      const clippers = this.parseToClipperArray((source as any).NOR);
      if (clippers)
        return this.createCaptureUnion(clippers, false);
    } else if (source.hasOwnProperty("AND")) {
      const clippers = this.parseToClipperArray((source as any).AND);
      if (clippers)
        return this.createCaptureIntersection(clippers, true);
    } else if (source.hasOwnProperty("NAND")) {
      const clippers = this.parseToClipperArray((source as any).NAND);
      if (clippers)
        return this.createCaptureIntersection(clippers, true);
    } else if (source.hasOwnProperty("XOR")) {
      const clippers = this.parseToClipperArray((source as any).XOR);
      if (clippers)
        return this.createCaptureParity(clippers, true);
    } else if (source.hasOwnProperty("NXOR")) {
      const clippers = this.parseToClipperArray((source as any).NXOR);
      if (clippers)
        return this.createCaptureParity(clippers, true);
    }
    return undefined;
  }
  /** Choose a `toJSON` method appropriate to the clipper */
  public static anyClipperToJSON(clipper: any): any | undefined {
    if (ClipUtilities.isClipper(clipper)) {
      if (clipper.toJSON)
        return clipper.toJSON();
    }
    return undefined;

  }
}
