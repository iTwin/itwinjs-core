/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { FeatureIndexType, FeatureIndex } from "@bentley/imodeljs-common";

export class IndexedPrimitiveParamsFeatures {
  public type: FeatureIndexType;
  public uniform: number;
  public nonUniform: Uint32Array | undefined;

  public constructor(index?: FeatureIndex, nVerts?: number) {
    this.type = FeatureIndexType.Empty;
    this.uniform = 0;
    this.nonUniform = undefined;
    if (undefined !== index) {
      this.type = index.type;
      if (FeatureIndexType.Uniform === index.type)
        this.uniform = index.featureID;
      else if (FeatureIndexType.NonUniform === index.type) {
        assert(undefined !== nVerts);
        assert(undefined !== index.featureIDs);
        if (undefined !== nVerts && undefined !== index.featureIDs) {
          assert(0 < nVerts);
          this.nonUniform = new Uint32Array(nVerts);
          for (let i = 0; i < nVerts; ++i) {
            this.nonUniform[i] = index.featureIDs[i];
          }
        }
      }
    }
  }

  public clear(): void {
    if (undefined !== this.nonUniform) {
      this.nonUniform = undefined;
    }
    this.type = FeatureIndexType.Empty;
  }
  public isUniform(): boolean { return FeatureIndexType.Uniform === this.type; }
  public isEmpty(): boolean { return FeatureIndexType.Empty === this.type; }

  public toFeatureIndex(): FeatureIndex {
    const fIndex: FeatureIndex = new FeatureIndex();
    fIndex.type = this.type;
    fIndex.featureID = this.uniform;
    fIndex.featureIDs = (undefined === this.nonUniform ? undefined : new Uint32Array(this.nonUniform.buffer));
    return fIndex;
  }
}

export const enum PolylineParam {
  kNone = 0,
  kSquare = 1 * 3,
  kMiter = 2 * 3,
  kMiterInsideOnly = 3 * 3,
  kJointBase = 4 * 3,
  kNegatePerp = 8 * 3,
  kNegateAlong = 16 * 3,
  kNoneAdjWt = 32 * 3,
}

export class PolylineParamVertex {
  public point: Point3d;
  public prevPoint: Point3d;
  public nextPoint: Point3d;
  public color: number;
  public attrib: number;
  public length: number;
  public isSegmentStart: boolean;
  public isPolylineStartOrEnd: boolean;

  public constructor(isSegmentStart: boolean, isPolylineStartOrEnd: boolean, point: Point3d,
    prevPoint: Point3d, nextPoint: Point3d, color: number, attrib: number, length: number) {
    this.isSegmentStart = isSegmentStart;
    this.isPolylineStartOrEnd = isPolylineStartOrEnd;
    this.point = point;
    this.prevPoint = prevPoint;
    this.nextPoint = nextPoint;
    this.color = color;
    this.attrib = attrib;
    this.length = length;
  }

  public DotProduct(): number {
    const prevDir: Vector3d = Vector3d.createStartEnd(this.prevPoint, this.point);
    prevDir.normalizeInPlace();
    const nextDir: Vector3d = Vector3d.createStartEnd(this.nextPoint, this.point);
    nextDir.normalizeInPlace();
    return prevDir.dotProduct(nextDir);
  }

  public GetParam(negatePerp: boolean, adjacentToJoint: boolean = false, joint: boolean = false, noDisplacement: boolean = false): PolylineParam {
    if (joint)
      return PolylineParam.kJointBase;

    let param: PolylineParam = this.isPolylineStartOrEnd ? PolylineParam.kSquare : PolylineParam.kMiter;

    if (noDisplacement)
      param = PolylineParam.kNoneAdjWt; // prevent getting tossed before width adjustment
    else if (adjacentToJoint)
      param = PolylineParam.kMiterInsideOnly;

    let adjust: PolylineParam = PolylineParam.kNone;
    if (negatePerp)
      adjust = PolylineParam.kNegatePerp;

    if (!this.isSegmentStart)
      adjust += PolylineParam.kNegateAlong;

    param = adjust + param;
    return param;
  }
}
