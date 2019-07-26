/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d } from "./Point3dVector3d";
import { Range1d } from "./Range";
import { PolylineCompressByEdgeOffset } from "./PolylineCompressionByEdgeOffset";
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
   * @param source
   * @param chordTolerance
   */
  public static compressByChordError(source: Point3d[], chordTolerance: number): Point3d[] {
    return PolylineCompressByEdgeOffset.compressPoint3dArrayByChordError(source, chordTolerance);
  }
}
