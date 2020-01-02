/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module CartesianGeometry */

import { Point3d } from "./Point3dVector3d";
import { Range1d } from "./Range";
import { PolylineCompressionContext } from "./PolylineCompressionByEdgeOffset";
import { GrowableXYZArray } from "./GrowableXYZArray";
// cspell:word Puecker
/**
 * PolylineOps is a collection of static methods operating on polylines.
 * @public
 */
export class PolylineOps {
  /**
   * Return a Range1d with the shortest and longest edge lengths of the polyline.
   * @param points points to examine.
   */
  public static edgeLengthRange(points: Point3d[]): Range1d {
    const range = Range1d.createNull();
    for (let i = 1; i < points.length; i++) {
      range.extendX(points[i - 1].distance(points[i]));
    }
    return range;
  }
  /**
   * Return a simplified subset of given points.
   * * Points are removed by the Douglas-Puecker algorithm, viz https://en.wikipedia.org/wiki/Ramer–Douglas–Peucker_algorithm
   * * This is a global search, with multiple passes over the data.
   * @param source
   * @param chordTolerance
   */
  public static compressByChordError(source: Point3d[], chordTolerance: number): Point3d[] {
    return PolylineCompressionContext.compressPoint3dArrayByChordError(source, chordTolerance);
  }
  /**
   * Return a simplified subset of given points, omitting points if very close to their neighbors.
   * * This is a local search, with a single pass over the data.
   * @param source input points
   * @param maxEdgeLength
   */
  public static compressShortEdges(source: Point3d[], maxEdgeLength: number): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    PolylineCompressionContext.compressInPlaceByShortEdgeLength(dest, maxEdgeLength);
    return dest.getPoint3dArray();
  }
  /**
   * Return a simplified subset of given points, omitting points of the triangle with adjacent points is small.
   * * This is a local search, with a single pass over the data.
   * @param source input points
   * @param maxEdgeLength
   */
  public static compressSmallTriangles(source: Point3d[], maxTriangleArea: number): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    PolylineCompressionContext.compressInPlaceBySmallTriangleArea(dest, maxTriangleArea);
    return dest.getPoint3dArray();
  }

  /**
   * Return a simplified subset of given points, omitting points if close to the edge between neighboring points before and after
   * * This is a local search, with a single pass over the data for each pass.
   * @param source input points
   * @param maxDistance omit points if this close to edge between points before and after
   * @param numPass max number of times to run the filter.  numPass=2 is observed to behave well.
   *
   */
  public static compressByPerpendicularDistance(source: Point3d[], maxDistance: number, numPass: number = 2): Point3d[] {
    const dest = GrowableXYZArray.create(source);
    let num0 = dest.length;
    for (let pass = 0; pass < numPass; pass++) {
      PolylineCompressionContext.compressInPlaceByPerpendicularDistance(dest, maxDistance);
      const num1 = dest.length;
      if (num1 === num0)
        break;
      num0 = num1;
    }
    return dest.getPoint3dArray();
  }

}
