/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module Polyface */

import { Point3d } from "../PointVector";
//
//      2------------------3
//      | \     F4       / |
//      |   6----------7   |
//      |   |          |   |   (BOTTOM = F0)
//      |F5 |   F1     |F3 |
//      |   |          |   |
//      |   4----------5   |
//      | /     F2       \ |
//      0------------------1
//
export class BoxTopology {
  public static points = [
    Point3d.create(0, 0, 0),
    Point3d.create(1, 0, 0),
    Point3d.create(0, 1, 0),
    Point3d.create(1, 1, 0),
    Point3d.create(0, 0, 1),
    Point3d.create(1, 0, 1),
    Point3d.create(0, 1, 1),
    Point3d.create(1, 1, 1),
  ];
  public static readonly primaryCapId = -1;
  // cornerIndexCCW[face][*] = vertices around face
  public static readonly cornerIndexCCW =
    [
      [1, 0, 2, 3],
      [4, 5, 7, 6],
      [0, 1, 5, 4],
      [1, 3, 7, 5],
      [3, 2, 6, 7],
      [2, 0, 4, 6]];
  // [partnerFace[faceIndex][*] = adjacent face indices.
  public static readonly partnerFace =
    [
      [5, 4, 3, 2],
      [2, 3, 4, 5],
      [0, 3, 1, 5],
      [0, 4, 1, 2],
      [0, 5, 1, 3],
      [0, 2, 1, 4],
    ];

  public static readonly faceId = [
    [BoxTopology.primaryCapId, 0],
    [BoxTopology.primaryCapId, 1],
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3]];
  // faceDirections[faceIndex] =[[edge0AxisIndex, edge1AxisIndex, normalAxisIndex],[direction sign for along the axis]
  public static readonly faceDirections =
    [
      [[0, 1, 2], [-1, 1, -1]],
      [[0, 1, 2], [1, 1, 1]],
      [[0, 2, 1], [1, -1, 1]],
      [[1, 2, 0], [1, 1, 1]],
      [[0, 2, 1], [-1, 1, 1]],
      [[1, 2, 0], [-1, 1, -1]]];
  // axisEdgeVertex[axisIndex][edgeIndex 0..3][*] = vertex index at end of edge in axisIndex direction.
  public static readonly axisEdgeVertex =
    [
      [[0, 1], [2, 3], [4, 5], [6, 7]],
      [[0, 2], [1, 3], [4, 6], [5, 7]],
      [[0, 4], [1, 5], [2, 6], [3, 7]]];
}
