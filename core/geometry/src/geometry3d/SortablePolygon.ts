/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { AnyRegion } from "../curve/CurveChain";
import { CurveChain } from "../curve/CurveCollection";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineString3d } from "../curve/LineString3d";
import { Loop } from "../curve/Loop";
import { ParityRegion } from "../curve/ParityRegion";
import { RegionOps } from "../curve/RegionOps";
import { UnionRegion } from "../curve/UnionRegion";
import { IndexedReadWriteXYZCollection, IndexedXYZCollection } from "./IndexedXYZCollection";
import { Point3d } from "./Point3dVector3d";
import { PolygonOps } from "./PolygonOps";
import { Range3d } from "./Range";
import { XAndY } from "./XYZProps";

/** abstract base class for area-related queries of a loop.
 * * subclasses have particular logic for `Loop` and polygon data.
 * @internal
 */
abstract class SimpleRegionCarrier {
  public abstract classifyPointXY(xy: XAndY): number | undefined;
  // Find any point on an edge.
  // evaluate tangent.
  // move to left or right according to signedArea, producing an interior point for the loop.
  public abstract getAnyInteriorPoint(): Point3d | undefined;
  /**
   * * grab the loop formatted as a simple polygon.
   * * stroke if necessary.
   */
  public abstract grabPolygon(): IndexedReadWriteXYZCollection | undefined;
  /**
   * * grab the loop formatted as a strongly typed loop object
   */
  public abstract grabLoop(): Loop | undefined;
  /**
   * (Property access) Return the signed area of the loop
   */
  public abstract get signedArea(): number;
  /**
   * If the current `signedArea` has different sign versus `targetSign`, reverse the loop in place.
   */
  public abstract reverseForAreaSign(targetSign: number): void;
}
/**
 * Implement `LoopCarrier` queries with the area as a polygon carried in an `IndexedReadWriteXYZCollection`
 */
class PolygonCarrier extends SimpleRegionCarrier {
  public data: IndexedReadWriteXYZCollection;
  private _signedArea: number;
  public get signedArea(): number { return this._signedArea; }
  public constructor(data: IndexedReadWriteXYZCollection) {
    super();
    this.data = data;
    this._signedArea = PolygonOps.areaXY(data);
  }
  /**
   * classify xy parts of point wrt this loop.
   * @param xy
   * @internal
   */
  public classifyPointXY(xy: XAndY): number | undefined {
    return PolygonOps.classifyPointInPolygonXY(xy.x, xy.y, this.data);
  }
  /** Return some point "inside"
   * NEEDS WORK: this returns a point ON --
   */
  public getAnyInteriorPoint(): Point3d | undefined {
    for (let childIndex = 0; childIndex < this.data.length; childIndex++) {
      const q = this.constructInteriorPointNearEdge(childIndex, 0.2349);
      if (q !== undefined)
        return q;
    }
    return undefined;
  }
  public grabPolygon(): IndexedReadWriteXYZCollection | undefined { return this.data; }
  public grabLoop(): Loop | undefined {
    return Loop.createPolygon(this.data);
  }
  public reverseForAreaSign(targetSign: number) {
    if (targetSign * this._signedArea < 0.0) {
      this.data.reverseInPlace();
      this._signedArea *= -1.0;
    }
  }
  public constructInteriorPointNearEdge(edgeIndex: number, fractionAlong: number): Point3d | undefined {
    if (edgeIndex + 1 < this.data.length) {
      const point0 = this.data.getPoint3dAtUncheckedPointIndex(edgeIndex);
      const point1 = this.data.getPoint3dAtUncheckedPointIndex(edgeIndex + 1);
      const vector = point0.vectorTo(point1);
      const point = point0.interpolate(fractionAlong, point1);
      vector.rotate90CCWXY(vector);
      if (vector.normalizeInPlace()) {
        if (this._signedArea < 0)
          vector.scaleInPlace(-1.0);
        const refDistance = Math.sqrt(Math.abs(this._signedArea));
        for (let fraction = 1.0e-5; fraction < 3; fraction *= 5.0) {
          const candidatePoint = point.plusScaled(vector, fraction * refDistance);
          if (1 === this.classifyPointXY(candidatePoint))
            return candidatePoint;
        }
      }
    }
    return undefined;
  }

}
/**
 * Implement `LoopCarrier` queries with the area as a strongly typed `Loop`
 */
class LoopCarrier extends SimpleRegionCarrier {
  public data: Loop;
  private _signedArea: number;
  public get signedArea(): number { return this._signedArea; }
  public constructor(data: Loop) {
    super();
    this.data = data;
    const areaMoments = RegionOps.computeXYAreaMoments(data);
    this._signedArea = areaMoments !== undefined ? areaMoments.quantitySum : 0.0;
  }
  /**
   * classify xy parts of point wrt this loop.
   * @param xy
   * @internal
   */
  public classifyPointXY(xy: XAndY): number | undefined {
    return RegionOps.testPointInOnOutRegionXY(this.data, xy.x, xy.y);
  }
  public constructInteriorPointNearChild(childIndex: number, fractionAlong: number): Point3d | undefined {
    if (childIndex < this.data.children.length) {
      const primitive = this.data.children[childIndex];
      const ray = primitive.fractionToPointAndUnitTangent(fractionAlong);
      ray.direction.rotate90CCWXY(ray.direction);
      if (this._signedArea < 0.0)
        ray.direction.scaleInPlace(-1.0);
      const refDistance = Math.sqrt(Math.abs(this._signedArea));
      for (let fraction = 1.0e-5; fraction < 3; fraction *= 5.0) {
        const candidatePoint = ray.fractionToPoint(fraction * refDistance);
        if (1 === this.classifyPointXY(candidatePoint))
          return candidatePoint;
      }
    }
    return undefined;
  }
  /** Return some point "inside"
   * NEEDS WORK: this returns a point ON --
   */
  public getAnyInteriorPoint(): Point3d | undefined {
    for (let childIndex = 0; childIndex < this.data.children.length; childIndex++) {
      const q = this.constructInteriorPointNearChild(childIndex, 0.2349);
      if (q !== undefined)
        return q;
    }
    return undefined;
  }
  public grabPolygon(): IndexedReadWriteXYZCollection | undefined {
    const strokes = this.data.cloneStroked();
    if (strokes instanceof CurveChain) {
      const linestring = LineString3d.create();
      for (const child of strokes.children) {
        if (child instanceof CurvePrimitive) {
          child.emitStrokes(linestring);
        }
      }
      return linestring.numPoints() > 0 ? linestring.packedPoints : undefined;
    }
    return undefined;
  }
  public grabLoop(): Loop | undefined {
    return this.data;
  }
  public reverseForAreaSign(targetSign: number) {
    if (targetSign * this._signedArea < 0.0) {
      this.data.reverseChildrenInPlace();
      this._signedArea *= -1.0;
    }
  }
}

/**
 * A `SortablePolygon` carries a (single) loop with data useful for sorting for inner-outer structure.
 * @internal
 */
export class SortablePolygon {
  private _loopCarrier: SimpleRegionCarrier;
  public anyPoint?: Point3d;
  public sortKey: number;
  public range: Range3d;
  public parentIndex?: number;
  public isHole: boolean;
  public outputSetIndex?: number;
  /**
   *
   * @param loop Loop to capture.
   */
  public constructor(loop: IndexedReadWriteXYZCollection | Loop, range: Range3d) {
    if (loop instanceof IndexedReadWriteXYZCollection)
      this._loopCarrier = new PolygonCarrier(loop);
    else
      this._loopCarrier = new LoopCarrier(loop);
    this.range = range;
    this.sortKey = Math.abs(this._loopCarrier.signedArea);
    this.isHole = false;
  }
  /** Push loop with sort data onto the array.
   * * No action if no clear normal.
   * * return true if pushed.
   */
  public static pushPolygon(loops: SortablePolygon[], loop: IndexedReadWriteXYZCollection): boolean {
    const range = loop.getRange();
    const sortablePolygon = new SortablePolygon(loop, range);
    if (sortablePolygon.sortKey > 0.0) {
      loops.push(sortablePolygon);
      return true;
    }
    return false;
  }
  /** Push loop with sort data onto the array.
   * * No action if no clear normal.
   * * return true if pushed.
   */
  public static pushLoop(loops: SortablePolygon[], loop: Loop): boolean {
    const range = loop.range();
    const sortablePolygon = new SortablePolygon(loop, range);
    if (sortablePolygon.sortKey > 0.0) {
      loops.push(sortablePolygon);
      return true;
    }
    return false;
  }
  /** Push loop with sort data onto the array.
   * * No action if no clear normal.
   * * return true if pushed.
   */
  private static assignParentsAndDepth(loops: SortablePolygon[]): void {
    // Sort largest to smallest ...
    loops.sort((loopA: SortablePolygon, loopB: SortablePolygon) => (loopB.sortKey - loopA.sortKey));
    // starting with smallest loop, point each loop to smallest containing parent.
    for (let i = loops.length; i-- > 0;) {
      const thisLoop = loops[i];
      const xy = thisLoop._loopCarrier.getAnyInteriorPoint();
      if (xy !== undefined) {
        // find smallest containing parent (search forward only to hit)
        loops[i].parentIndex = undefined;
        loops[i].outputSetIndex = undefined;
        for (let j = i; j-- > 0;) {
          const otherLoop = loops[j];
          if (otherLoop.range.containsXY(xy.x, xy.y)) {
            if (1 === otherLoop._loopCarrier.classifyPointXY(xy)) {
              thisLoop.parentIndex = j;
              // The loops are searched from small area to larger.  Any other containing loop is larger, so otherLoop must be the smallest.
              break;
            }
          }
        }
      }
    }
  }

  private static assemblePolygonSet(loops: SortablePolygon[]): IndexedReadWriteXYZCollection[][] {
    const outputSets: IndexedReadWriteXYZCollection[][] = [];

    // In large-to-small order:
    // If a loop has no parent or has a "hole" as parent it is outer.
    // otherwise (i.e. it has a non-hole parent) it becomes a hole in the parent.
    for (const loopData of loops) {
      loopData.isHole = false;
      const parentIndex = loopData.parentIndex;
      if (parentIndex !== undefined)
        loopData.isHole = !loops[parentIndex].isHole;
      if (!loopData.isHole) {
        loopData._loopCarrier.reverseForAreaSign(1.0);
        loopData.outputSetIndex = outputSets.length;
        outputSets.push([]);
        outputSets[loopData.outputSetIndex].push(loopData._loopCarrier.grabPolygon()!);
      } else {
        loopData._loopCarrier.reverseForAreaSign(-1.0);
        const outputSetIndex = loops[parentIndex!].outputSetIndex!;
        outputSets[outputSetIndex].push(loopData._loopCarrier.grabPolygon()!);
      }
    }
    return outputSets;
  }
  private static assembleLoopSet(loops: SortablePolygon[]): AnyRegion[] {
    const outputSets: AnyRegion[] = [];
    const numLoops = loops.length;
    // In large-to-small order:
    // If a loop has no parent or has a "hole" as parent it is outer.
    // otherwise (i.e. it has a non-hole parent) it becomes a hole in the parent.
    for (let candidateIndex = 0; candidateIndex < numLoops; candidateIndex++) {
      const candidateData = loops[candidateIndex];
      const parentIndex = candidateData.parentIndex;
      candidateData.isHole = parentIndex !== undefined ? !loops[parentIndex].isHole : false;

      if (!candidateData.isHole) {
        candidateData._loopCarrier.reverseForAreaSign(1.0);
        const candidateLoop = candidateData._loopCarrier.grabLoop()!;
        let candidateParityRegion: ParityRegion | undefined;
        // find all directly contained children . . .
        for (let childIndex = candidateIndex + 1; childIndex < numLoops; childIndex++) {
          const childData = loops[childIndex];
          if (childData.parentIndex === candidateIndex) {
            if (candidateParityRegion === undefined) {
              candidateParityRegion = ParityRegion.create();
              candidateParityRegion.tryAddChild(candidateLoop);
              childData._loopCarrier.reverseForAreaSign(-1.0);
              candidateParityRegion.tryAddChild(childData._loopCarrier.grabLoop());
            } else {
              childData._loopCarrier.reverseForAreaSign(-1.0);
              candidateParityRegion.tryAddChild(childData._loopCarrier.grabLoop());
            }
          }
        }
        if (candidateParityRegion !== undefined)
          outputSets.push(candidateParityRegion);
        else if (candidateLoop !== undefined)
          outputSets.push(candidateLoop);
      }
    }
    return outputSets;
  }

  public static sortAsAnyRegion(loops: SortablePolygon[]): AnyRegion {
    this.assignParentsAndDepth(loops);
    const regions = this.assembleLoopSet(loops);
    if (regions.length === 1)
      return regions[0];
    else {
      const unionRegion = UnionRegion.create();
      for (const region of regions)
        unionRegion.tryAddChild(region);
      return unionRegion;
    }
  }
  public static sortAsArrayOfArrayOfPolygons(loops: SortablePolygon[]): IndexedReadWriteXYZCollection[][] {
    this.assignParentsAndDepth(loops);
    return this.assemblePolygonSet(loops);
  }
  public grabPolygon(): IndexedXYZCollection | undefined {
    return this._loopCarrier.grabPolygon();
  }
  public grabLoop(): Loop | undefined {
    return this._loopCarrier.grabLoop();
  }
  public reverseForAreaSign(targetSign: number) {
    this._loopCarrier.reverseForAreaSign(targetSign);
  }
  public getAnyInteriorPoint(): Point3d | undefined {
    return this._loopCarrier.getAnyInteriorPoint();
  }
}
