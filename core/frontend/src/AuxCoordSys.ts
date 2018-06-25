/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { AuxCoordSystemProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps, BisCodeSpec, Code, IModel, Npc, ColorDef, LinePixels } from "@bentley/imodeljs-common";
import { Angle, Point3d, Point2d, Vector3d, YawPitchRollAngles, XYAndZ, XAndY, RotMatrix, Transform, Arc3d, AngleSweep } from "@bentley/geometry-core";
import { JsonUtils } from "@bentley/bentleyjs-core";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { ViewState } from "./ViewState";
import { DecorateContext } from "./ViewContext";
import { GraphicBuilder } from "./render/GraphicBuilder";
import { Viewport, CoordSystem } from "./Viewport";

export const enum ACSType {
  None = 0,
  Rectangular = 1,
  Cylindrical = 2,
  Spherical = 3,
}

export const enum ACSDisplayOptions {
  None = 0, // used for testing individual bits.
  Active = (1 << 0),
  Deemphasized = (1 << 1),
  Hilite = (1 << 2),
  CheckVisible = (1 << 3),
  Dynamics = (1 << 4),
}

/** The state of an AuxCoordSystem element in the frontend */
export abstract class AuxCoordSystemState extends ElementState implements AuxCoordSystemProps {
  public type: number;
  public description?: string;

  public static fromProps(props: AuxCoordSystemProps, iModel: IModelConnection): AuxCoordSystemState {
    const name = props.classFullName.toLowerCase();
    if (name.endsWith("system2d"))
      return new AuxCoordSystem2dState(props, iModel);

    if (name.endsWith("system3d"))
      return new AuxCoordSystem3dState(props, iModel);

    return new AuxCoordSystemSpatialState(props, iModel);
  }

  /**
   * Create a new AuxCoordSystemState.
   * @param acsName the name for the new AuxCoordSystem
   * @param iModel the iModel for which the ACS applies.
   * @note call this method with the appropriate subclass (e.g. AuxCoordSystemSpatialState, AuxCoordSystem2dState, etc), not on AuxCoordSystemState directly
   */
  public static createNew(acsName: string, iModel: IModelConnection): AuxCoordSystemState {
    const myCode = new Code({ spec: BisCodeSpec.auxCoordSystemSpatial, scope: IModel.dictionaryId.toString(), value: acsName });
    return new AuxCoordSystemSpatialState({ model: IModel.dictionaryId, code: myCode, classFullName: this.getClassFullName() }, iModel);
  }

  public constructor(props: AuxCoordSystemProps, iModel: IModelConnection) {
    super(props, iModel);
    this.type = JsonUtils.asInt(props.type, ACSType.None);
    this.description = props.description;
  }
  public toJSON(): AuxCoordSystemProps {
    const val = super.toJSON() as AuxCoordSystemProps;
    val.type = this.type;
    val.description = this.description;
    return val;
  }

  public isValidForView(view: ViewState): boolean {
    if (view.isSpatialView())
      return this instanceof AuxCoordSystemSpatialState;
    return (view.is3d() === this.is3d());
  }

  public abstract getOrigin(result?: Point3d): Point3d;
  public abstract setOrigin(val: XYAndZ | XAndY): void;
  /** get a *copy of* the rotation matrix for this ACS. */
  public abstract getRotation(result?: RotMatrix): RotMatrix;
  public abstract setRotation(val: RotMatrix): void;
  public is3d(): boolean { return this instanceof AuxCoordSystem3dState; }

  public drawGrid(context: DecorateContext): void {
    // Called for active ACS when grid orientation is GridOrientationType::ACS.
    const view = context.viewport.view;
    context.drawStandardGrid(this.getOrigin(), this.getRotation(), view.getGridSpacing(), view.getGridsPerRef(), false, undefined);
  }

  /** Returns the value if it falls within the bounds given. Otherwise, returns the offended boundary. */
  private static limitRange(min: number, max: number, val: number): number {
    if (val < min)
      return min;
    else if (val > max)
      return max;
    return val;
  }

  /**
   * Given an origin point, returns whether the point falls within the view or not. If adjustOrigin is set to true, a point outside
   * the view will be modified to fall within the appropriate range.
   */
  public static isOriginInView(drawOrigin: Point3d, viewport: Viewport, adjustOrigin: boolean): boolean {
    const frustum = viewport.getFrustum(CoordSystem.Screen, false);

    const testPtView = viewport.worldToView(drawOrigin);
    const screenRange = Point3d.create(
      frustum.getCorner(Npc._000).distance(frustum.getCorner(Npc._100)),
      frustum.getCorner(Npc._000).distance(frustum.getCorner(Npc._010)),
      frustum.getCorner(Npc._000).distance(frustum.getCorner(Npc._001)));

    // Check if current acs origin is outside view...
    const inView = (!((testPtView.x < 0 || testPtView.x > screenRange.x) || (testPtView.y < 0 || testPtView.y > screenRange.y)));

    if (!adjustOrigin)
      return inView;

    if (!inView) {
      const offset = viewport.pixelsFromInches(0.6);  // TRIAD_SIZE_INCHES magic constant
      testPtView.x = AuxCoordSystemState.limitRange(offset, screenRange.x - offset, testPtView.x);
      testPtView.y = AuxCoordSystemState.limitRange(offset, screenRange.y - offset, testPtView.y);
    }

    // Limit point to NPC box to prevent triad from being clipped from display...
    const originPtNpc = viewport.viewToNpc(testPtView);
    originPtNpc.x = AuxCoordSystemState.limitRange(0, 1, originPtNpc.x);
    originPtNpc.y = AuxCoordSystemState.limitRange(0, 1, originPtNpc.y);
    originPtNpc.z = AuxCoordSystemState.limitRange(0, 1, originPtNpc.z);
    viewport.npcToView(originPtNpc, testPtView);
    viewport.viewToWorld(testPtView, drawOrigin);

    return inView;
  }

  private getAdjustedColor(inColor: ColorDef, isFill: boolean, viewport: Viewport, options: ACSDisplayOptions): ColorDef {
    const color = new ColorDef();

    if ((options & ACSDisplayOptions.Hilite) !== ACSDisplayOptions.None) {
      color.setFrom(viewport.hilite.color);
    } else if ((options & ACSDisplayOptions.Active) !== ACSDisplayOptions.None) {
      color.setFrom(inColor.equals(ColorDef.white) ? viewport.getContrastToBackgroundColor() : inColor);
    } else {
      color.colors.r = 150;
      color.colors.g = 150;
      color.colors.b = 150;
      color.colors.t = 0;
    }

    color.adjustForContrast(viewport.view.backgroundColor);

    if (isFill)
      color.setTransparency((options & (ACSDisplayOptions.Deemphasized | ACSDisplayOptions.Dynamics)) !== ACSDisplayOptions.None ? 255 : 200);
    else
      color.setTransparency((options & ACSDisplayOptions.Deemphasized) !== ACSDisplayOptions.None ? 150 : 75);

    return color;
  }

  private addAxis(builder: GraphicBuilder, axis: number, options: ACSDisplayOptions, vp: Viewport) {
    if (axis === 2) {
      const color = ColorDef.blue;
      const linePts: Point3d[] = [Point3d.create(), Point3d.create()];
      linePts[1].z = 0.65;

      const lineColor = this.getAdjustedColor(color, false, vp, options);
      const fillColor = this.getAdjustedColor(color, true, vp, options);

      builder.setSymbology(lineColor, lineColor, 6);
      builder.addPointString(linePts);

      builder.setSymbology(lineColor, lineColor, 1, (options & ACSDisplayOptions.Dynamics) === ACSDisplayOptions.None ? LinePixels.Solid : LinePixels.Code2);
      builder.addLineString(linePts);

      const scale = 0.2;  // ARROW_TIP_WIDTH / 2
      const center = Point3d.create();
      const viewRMatrix = vp.rotMatrix;

      const xVec = viewRMatrix.getRow(0);
      const yVec = viewRMatrix.getRow(1);

      builder.localToWorldTransform.matrix.multiplyTransposeVectorInPlace(xVec);
      builder.localToWorldTransform.matrix.multiplyTransposeVectorInPlace(yVec);

      xVec.normalize(xVec);
      yVec.normalize(yVec);

      const ellipse = Arc3d.createScaledXYColumns(center, RotMatrix.createColumns(xVec, yVec, Vector3d.create()), scale, scale, AngleSweep.createStartEnd(Angle.createRadians(0), Angle.createRadians(Math.PI * 2)));
      builder.addArc(ellipse, false, false);

      builder.setBlankingFill(fillColor);
      builder.addArc(ellipse, true, true);
      return;
    }
  }

  /** Returns a GraphicBuilder for this AuxCoordSystemState. */
  private createGraphic(context: DecorateContext, options: ACSDisplayOptions): GraphicBuilder {
    const checkOutOfView = (options & ACSDisplayOptions.CheckVisible) !== ACSDisplayOptions.None;
    const drawOrigin = this.getOrigin();

    if (checkOutOfView && !AuxCoordSystemState.isOriginInView(drawOrigin, context.viewport, true))
      options = options | ACSDisplayOptions.Deemphasized;

    let pixelSize = context.viewport.pixelsFromInches(0.6);  // TRIAD_SIZE_INCHES: Active size...

    if ((options & ACSDisplayOptions.Deemphasized) !== ACSDisplayOptions.None)
      pixelSize *= 0.8;
    else if ((options & ACSDisplayOptions.Active) !== ACSDisplayOptions.None)
      pixelSize *= 0.9;

    const exagg = context.viewport.view.getAspectRatioSkew();
    const scale = context.getPixelSizeAtPoint(drawOrigin) * pixelSize;
    const rMatrix = this.getRotation();
    rMatrix.inverse(rMatrix);   // Assuming that this will not fail..
    rMatrix.scaleRows(scale, scale / exagg, scale);
    const transform = Transform.createOriginAndMatrix(drawOrigin, rMatrix);

    const graphic = context.createWorldOverlay(transform);
    const vp = context.viewport;
    this.addAxis(graphic, 0, options, vp);
    this.addAxis(graphic, 1, options, vp);
    this.addAxis(graphic, 2, options, vp);

    return graphic;
  }

  public display(context: DecorateContext, options: ACSDisplayOptions) {
    const graphic = this.createGraphic(context, options);
    if (!graphic)
      return;
    context.addWorldOverlay(graphic.finish());
  }
}

/** The state of an AuxCoordSystem2d element in the frontend */
export class AuxCoordSystem2dState extends AuxCoordSystemState implements AuxCoordSystem2dProps {
  public readonly origin: Point2d;
  public angle: number; // in degrees
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem2dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.origin = Point2d.fromJSON(props.origin);
    this.angle = JsonUtils.asDouble(props.angle);
    this._rMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createDegrees(this.angle))!;
  }

  public toJSON(): AuxCoordSystem2dProps {
    const val = super.toJSON() as AuxCoordSystem2dProps;
    val.origin = this.origin;
    val.angle = this.angle;
    return val;
  }

  public getOrigin(result?: Point3d): Point3d { return Point3d.createFrom(this.origin, result); }
  public setOrigin(val: XYAndZ | XAndY): void { this.origin.setFrom(val); }
  public getRotation(result?: RotMatrix): RotMatrix { return this._rMatrix.clone(result); }
  public setRotation(val: RotMatrix): void {
    this._rMatrix.setFrom(val);
    this.angle = YawPitchRollAngles.createFromRotMatrix(val)!.yaw.degrees;
  }
}

/** The state of an AuxCoordSystem3d element in the frontend */
export class AuxCoordSystem3dState extends AuxCoordSystemState implements AuxCoordSystem3dProps {
  public readonly origin: Point3d;
  public yaw: number;
  public pitch: number;
  public roll: number;
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem3dProps, iModel: IModelConnection) {
    super(props, iModel);
    this.origin = Point3d.fromJSON(props.origin);
    this.yaw = JsonUtils.asDouble(props.yaw);
    this.pitch = JsonUtils.asDouble(props.pitch);
    this.roll = JsonUtils.asDouble(props.roll);
    const angles = new YawPitchRollAngles(Angle.createRadians(this.yaw), Angle.createRadians(this.pitch), Angle.createRadians(this.roll));
    this._rMatrix = angles.toRotMatrix();
  }

  public toJSON(): AuxCoordSystem3dProps {
    const val = super.toJSON() as AuxCoordSystem3dProps;
    val.origin = this.origin;
    val.yaw = this.yaw;
    val.pitch = this.pitch;
    val.roll = this.roll;
    return val;
  }

  public getOrigin(result?: Point3d): Point3d { return Point3d.createFrom(this.origin, result); }
  public setOrigin(val: XYAndZ | XAndY): void { this.origin.setFrom(val); }
  public getRotation(result?: RotMatrix): RotMatrix { return this._rMatrix.clone(result); }
  public setRotation(rMatrix: RotMatrix): void {
    this._rMatrix.setFrom(rMatrix);
    const angles = YawPitchRollAngles.createFromRotMatrix(rMatrix)!;
    this.yaw = angles.yaw.radians;
    this.pitch = angles.pitch.radians;
    this.roll = angles.roll.radians;
  }
}

/** The state of an AuxCoordSystemSpatial element in the frontend */
export class AuxCoordSystemSpatialState extends AuxCoordSystem3dState {
}
