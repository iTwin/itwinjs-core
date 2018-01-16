/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewState } from "./ViewState";
import { AuxCoordSystemProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps } from "./ElementProps";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Point3d, RotMatrix, Point2d, Vector3d, YawPitchRollAngles, XYAndZ, XAndY } from "@bentley/geometry-core/lib/PointVector";
import { IModel } from "./IModel";
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { Code, CodeSpecNames } from "./Code";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ElementState } from "./EntityState";

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

export abstract class AuxCoordSystemState extends ElementState implements AuxCoordSystemProps {
  public type: number;
  public description?: string;

  public static fromProps(props: AuxCoordSystemProps, iModel: IModel): AuxCoordSystemState {
    const name = props.classFullName.toLowerCase();
    if (name.endsWith("system2d"))
      return new AuxCoordSystem2dState(props, iModel);

    if (name.endsWith("system3d"))
      return new AuxCoordSystem3dState(props, iModel);

    return new AuxCoordSystemSpatialState(props, iModel);
  }

  /**
   * Create a new AuxCoordSystem.
   * @param acsName the name for the new AuxCoordSystem
   * @param iModel the iModel for which the ACS applies.
   * @note call this method with the appropriate subclass (e.g. AuxCoordSystemSpatialState, AuxCoordSystem2dState, etc), not on AuxCoordSystemState directly
   */
  public static createNew(acsName: string, iModel: IModel): AuxCoordSystemState {
    const myCode = new Code({ spec: CodeSpecNames.AuxCoordSystemSpatial(), scope: IModel.getDictionaryId().toString(), value: acsName });
    return new AuxCoordSystemSpatialState({ model: IModel.getDictionaryId(), code: myCode, classFullName: this.getClassFullName(), id: new Id64() }, iModel);
  }

  public constructor(props: AuxCoordSystemProps, iModel: IModel) {
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
}

export class AuxCoordSystem2dState extends AuxCoordSystemState implements AuxCoordSystem2dProps {
  public readonly origin: Point2d;
  public angle: number; // in degrees
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem2dProps, iModel: IModel) {
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

export class AuxCoordSystem3dState extends AuxCoordSystemState implements AuxCoordSystem3dProps {
  public readonly origin: Point3d;
  public yaw: number;
  public pitch: number;
  public roll: number;
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem3dProps, iModel: IModel) {
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

export class AuxCoordSystemSpatialState extends AuxCoordSystem3dState {
}
