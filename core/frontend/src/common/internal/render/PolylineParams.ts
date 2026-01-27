/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { LinePixels, PolylineIndices, PolylineTypeFlags, QPoint3dList } from "@itwin/core-common";
import { VertexIndices } from "./VertexIndices";
import { VertexTable } from "./VertexTable";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { assert } from "@itwin/core-bentley";
import { VertexTableBuilder } from "./VertexTableBuilder";
import { MeshArgsPositions } from "../../../render/MeshArgs";
import { PolylineArgs } from "../../../render/PolylineArgs";
import { MeshPolylineList } from "@itwin/core-common/lib/cjs/internal/RenderMesh";

/** Represents a tesselated polyline.
 * Given a polyline as a line string, each segment of the line string is triangulated into a quad.
 * Based on the angle between two segments, additional joint triangles may be inserted in between to enable smoothly-rounded corners.
 * @internal
 */
export interface TesselatedPolyline {
  /** 24-bit index of each vertex. */
  indices: VertexIndices;
  /** 24-bit index of the previous vertex in the polyline. */
  prevIndices: VertexIndices;
  /** 24-bit index of the next vertex in the polyline, plus 8-bit parameter describing the semantics of this vertex. */
  nextIndicesAndParams: Uint8Array;
  /** Cumulative distance from linestring start for each vertex (in model/world units). Used for stable pattern rendering. */
  cumulativeDistances?: Float32Array;
}

/** @internal */
export interface PolylineParams {
  vertices: VertexTable;
  polyline: TesselatedPolyline;
  isPlanar: boolean;
  type: PolylineTypeFlags;
  weight: number;
  linePixels: LinePixels;
}

/** Parameter associated with each vertex index of a tesselated polyline. */
const enum PolylineParam { // eslint-disable-line no-restricted-syntax
  kNone = 0,
  kSquare = 1 * 3,
  kMiter = 2 * 3,
  kMiterInsideOnly = 3 * 3,
  kJointBase = 4 * 3,
  kNegatePerp = 8 * 3,
  kNegateAlong = 16 * 3,
  kNoneAdjustWeight = 32 * 3,
}

export function tesselatePolylineList(args: {
  points: MeshArgsPositions,
  polylines: MeshPolylineList,
  width: number,
  is2d: boolean,
  cumulativeDistances?: Float32Array,
}): TesselatedPolyline {
  const tesselator = PolylineTesselator.create(args);
  return tesselator.tesselate();
}

class PolylineVertex {
  public isSegmentStart: boolean = false;
  public isPolylineStartOrEnd: boolean = false;
  public vertexIndex: number = 0;
  public prevIndex: number = 0;
  public nextIndex: number = 0;

  public constructor() { }

  public init(isSegmentStart: boolean, isPolylineStartOrEnd: boolean, vertexIndex: number, prevIndex: number, nextIndex: number) {
    this.isSegmentStart = isSegmentStart;
    this.isPolylineStartOrEnd = isPolylineStartOrEnd;
    this.vertexIndex = vertexIndex;
    this.prevIndex = prevIndex;
    this.nextIndex = nextIndex;
  }

  public computeParam(negatePerp: boolean, adjacentToJoint: boolean = false, joint: boolean = false, noDisplacement: boolean = false): number {
    if (joint)
      return PolylineParam.kJointBase;

    let param: PolylineParam;
    if (noDisplacement)
      param = PolylineParam.kNoneAdjustWeight; // prevent getting tossed before width adjustment
    else if (adjacentToJoint)
      param = PolylineParam.kMiterInsideOnly;
    else
      param = this.isPolylineStartOrEnd ? PolylineParam.kSquare : PolylineParam.kMiter;

    let adjust = 0;
    if (negatePerp)
      adjust = PolylineParam.kNegatePerp;
    if (!this.isSegmentStart)
      adjust += PolylineParam.kNegateAlong;

    return param + adjust;
  }
}

class PolylineTesselator {
  private _polylines: PolylineIndices[];
  private _doJoints: boolean;
  private _numIndices = 0;
  private _vertIndex: number[] = [];
  private _prevIndex: number[] = [];
  private _nextIndex: number[] = [];
  private _nextParam: number[] = [];
  private _position: Point3d[] = [];
  private _cumDist: number[] = []; // Cumulative distance for each tessellated vertex
  private _vertexCumDist?: Float32Array;

  public constructor(polylines: PolylineIndices[], points: QPoint3dList | Point3d[], doJointTriangles: boolean, cumulativeDistances?: Float32Array) {
    this._polylines = polylines;
    if (points instanceof QPoint3dList) {
      for (const p of points.list)
        this._position.push(p.unquantize(points.params));
    } else {
      this._position = points;
    }

    this._doJoints = doJointTriangles;
    this._vertexCumDist = cumulativeDistances;
  }

  public static fromPolyline(args: PolylineArgs): PolylineTesselator {
    return new PolylineTesselator(args.polylines, args.points, wantJointTriangles(args.width, !!args.flags.is2d), args.cumulativeDistances);
  }

  public static create(args: {
    points: MeshArgsPositions,
    polylines: MeshPolylineList,
    width: number,
    is2d: boolean,
    cumulativeDistances?: Float32Array,
  }): PolylineTesselator {
    return new PolylineTesselator(args.polylines.map((x) => x.indices), args.points, wantJointTriangles(args.width, args.is2d), args.cumulativeDistances);
  }

  public tesselate(): TesselatedPolyline {
    this._tesselate();

    const vertIndex = VertexIndices.fromArray(this._vertIndex);
    const prevIndex = VertexIndices.fromArray(this._prevIndex);

    const nextIndexAndParam = new Uint8Array(this._numIndices * 4);
    for (let i = 0; i < this._numIndices; i++) {
      const index = this._nextIndex[i];
      const j = i * 4;
      VertexIndices.encodeIndex(index, nextIndexAndParam, j);
      nextIndexAndParam[j + 3] = this._nextParam[i] & 0x000000ff;
    }

    const cumulativeDistances = new Float32Array(this._cumDist);

    return {
      indices: vertIndex,
      prevIndices: prevIndex,
      nextIndicesAndParams: nextIndexAndParam,
      cumulativeDistances,
    };
  }

  private _tesselate() {
    const v0 = new PolylineVertex(), v1 = new PolylineVertex();
    const maxJointDot = -0.7;

    for (const line of this._polylines) {
      if (line.length < 2)
        continue;

      const last = line.length - 1;
      const isClosed: boolean = line[0] === line[last];

      // Calculate cumulative distances for this linestring
      const lineCumDist: number[] = new Array(line.length);
      if (this._vertexCumDist) {
        for (let i = 0; i < line.length; i++) {
          const idx = line[i];
          lineCumDist[i] = idx < this._vertexCumDist.length ? this._vertexCumDist[idx] : 0.0;
        }
      } else { // This path is for decorations: compute cumulative distance from geometry.
        lineCumDist[0] = 0.0;
        for (let i = 1; i < line.length; i++) {
          const p0 = this._position[line[i - 1]];
          const p1 = this._position[line[i]];
          const dist = p0.distance(p1);
          lineCumDist[i] = lineCumDist[i - 1] + dist;
        }
      }

      for (let i = 0; i < last; ++i) {
        const idx0 = line[i];
        const idx1 = line[i + 1];
        const isStart: boolean = (0 === i);
        const isEnd: boolean = (last - 1 === i);
        const prevIdx0 = isStart ? (isClosed ? line[last - 1] : idx0) : line[i - 1];
        const nextIdx1 = isEnd ? (isClosed ? line[1] : idx1) : line[i + 2];

        v0.init(true, isStart && !isClosed, idx0, prevIdx0, idx1);
        v1.init(false, isEnd && !isClosed, idx1, nextIdx1, idx0);

        // Store cumulative distances for v0 and v1
        const cumDist0 = lineCumDist[i];
        const cumDist1 = lineCumDist[i + 1];

        const jointAt0: boolean = this._doJoints && (isClosed || !isStart) && this._dotProduct(v0) > maxJointDot;
        const jointAt1: boolean = this._doJoints && (isClosed || !isEnd) && this._dotProduct(v1) > maxJointDot;

        if (jointAt0 || jointAt1) {
          this._addVertex(v0, v0.computeParam(true, jointAt0, false, false), cumDist0);
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, false), cumDist1);
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true), cumDist0);
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true), cumDist0);
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, false), cumDist1);
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true), cumDist1);
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, true), cumDist0);
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true), cumDist1);
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, false), cumDist0);
          this._addVertex(v0, v0.computeParam(false, jointAt0, false, false), cumDist0);
          this._addVertex(v1, v1.computeParam(false, jointAt1, false, true), cumDist1);
          this._addVertex(v1, v1.computeParam(true, jointAt1, false, false), cumDist1);

          if (jointAt0)
            this.addJointTriangles(v0, v0.computeParam(false, true, false, true), v0, cumDist0);

          if (jointAt1)
            this.addJointTriangles(v1, v1.computeParam(false, true, false, true), v1, cumDist1);
        } else {
          this._addVertex(v0, v0.computeParam(true), cumDist0);
          this._addVertex(v1, v1.computeParam(false), cumDist1);
          this._addVertex(v0, v0.computeParam(false), cumDist0);
          this._addVertex(v0, v0.computeParam(false), cumDist0);
          this._addVertex(v1, v1.computeParam(false), cumDist1);
          this._addVertex(v1, v1.computeParam(true), cumDist1);
        }
      }
    }
  }

  private addJointTriangles(v0: PolylineVertex, p0: number, v1: PolylineVertex, cumDist: number): void {
    const param = v1.computeParam(false, false, true);
    for (let i = 0; i < 3; i++) {
      this._addVertex(v0, p0, cumDist);
      this._addVertex(v1, param + i + 1, cumDist);
      this._addVertex(v1, param + i, cumDist);
    }
  }

  private _dotProduct(v: PolylineVertex): number {
    const pos: Point3d = this._position[v.vertexIndex];
    const prevDir: Vector3d = Vector3d.createStartEnd(this._position[v.prevIndex], pos);
    const nextDir: Vector3d = Vector3d.createStartEnd(this._position[v.nextIndex], pos);
    return prevDir.dotProduct(nextDir);
  }

  private _addVertex(vertex: PolylineVertex, param: number, cumDist: number = 0): void {
    this._vertIndex[this._numIndices] = vertex.vertexIndex;
    this._prevIndex[this._numIndices] = vertex.prevIndex;
    this._nextIndex[this._numIndices] = vertex.nextIndex;
    this._nextParam[this._numIndices] = param;
    this._cumDist[this._numIndices] = cumDist;
    this._numIndices++;
  }
}

/** Strictly for tests. @internal */
export function tesselatePolyline(polylines: PolylineIndices[], points: QPoint3dList, doJointTriangles: boolean): TesselatedPolyline {
  const tesselator = new PolylineTesselator(polylines, points, doJointTriangles);
  return tesselator.tesselate();
}

/** @internal */
export function createPolylineParams(args: PolylineArgs, maxDimension: number): PolylineParams | undefined {
  assert(!args.flags.isDisjoint);
  const vertices = VertexTableBuilder.buildFromPolylines(args, maxDimension);
  if (undefined === vertices)
    return undefined;

  const tesselator = PolylineTesselator.fromPolyline(args);
  if (undefined === tesselator)
    return undefined;

  return {
    vertices,
    polyline: tesselator.tesselate(),
    isPlanar: !!args.flags.isPlanar,
    type: args.flags.type ?? PolylineTypeFlags.Normal,
    weight: args.width,
    linePixels: args.linePixels,
  };
}

/** @internal */
export function wantJointTriangles(weight: number, is2d: boolean): boolean {
  // Joints are incredibly expensive. In 3d, only generate them if the line is sufficiently wide for them to be noticeable.
  const jointWidthThreshold = 3;
  return is2d || weight >= jointWidthThreshold;
}
