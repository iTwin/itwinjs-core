/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module WebGL */

import { Point3d, Vector3d } from "@bentley/geometry-core";
import { FeatureIndexType } from "@bentley/imodeljs-common";
import { Target } from "./Target";
import { Graphic, Batch } from "./Graphic";
import { CachedGeometry } from "./CachedGeometry";
import { RenderPass, RenderOrder } from "./RenderFlags";
import { ShaderProgramExecutor } from "./ShaderProgram";
import { DrawParams } from "./DrawCommand";
import { TechniqueId } from "./TechniqueId";
import { FeaturesInfo } from "./FeaturesInfo";
import { RenderCommands, DrawCommand, DrawCommands } from "./DrawCommand";
import { dispose } from "@bentley/bentleyjs-core";

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

export abstract class Primitive extends Graphic {
  public cachedGeometry: CachedGeometry;
  public isPixelMode: boolean = false;

  public constructor(cachedGeom: CachedGeometry) { super(); this.cachedGeometry = cachedGeom; }

  public dispose() {
    dispose(this.cachedGeometry);
  }

  public getRenderPass(target: Target) {
    if (this.isPixelMode)
      return RenderPass.ViewOverlay;
    return this.cachedGeometry.getRenderPass(target);
  }

  public get featureIndexType(): FeatureIndexType {
    const feature = this.cachedGeometry.featuresInfo;
    if (feature instanceof FeaturesInfo)
      return feature.type;
    return FeatureIndexType.Empty;
  }

  public get usesMaterialColor(): boolean {
    const materialData = this.cachedGeometry.material;
    return undefined !== materialData && (materialData.overridesRgb || materialData.overridesAlpha);
  }

  public get isLit(): boolean { return this.cachedGeometry.isLitSurface; }

  public addCommands(commands: RenderCommands): void { commands.addPrimitive(this); }

  public addHiliteCommands(commands: DrawCommands, batch: Batch): void {
    // Edges do not contribute to hilite pass.
    // Note that IsEdge() does not imply geom->ToEdge() => true...polylines can be edges too...
    if (!this.isEdge) {
      commands.push(DrawCommand.createForPrimitive(this, batch));
    }
  }

  public setUniformFeatureIndices(featId: number): void { this.cachedGeometry.uniformFeatureIndices = featId; }

  public get isEdge(): boolean { return false; }

  public toPrimitive(): Primitive { return this; }

  public abstract get renderOrder(): RenderOrder;

  public draw(shader: ShaderProgramExecutor): void {
    // ###TODO: local to world should be pushed before we're invoked...we shouldn't need to pass (or copy) it
    const drawParams = new DrawParams(shader.target, this.cachedGeometry, shader.target.currentTransform, shader.renderPass);
    shader.draw(drawParams);
  }

  public getTechniqueId(target: Target): TechniqueId { return this.cachedGeometry.getTechniqueId(target); }

  public get debugString(): string { return this.cachedGeometry.debugString; }
}

export class SkyBoxPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}

export class PointCloudPrimitive extends Primitive {
  public constructor(cachedGeom: CachedGeometry) { super(cachedGeom); }
  public get renderOrder(): RenderOrder { return RenderOrder.Surface; }
}
