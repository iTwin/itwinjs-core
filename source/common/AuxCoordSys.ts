/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ElementState, ViewState } from "./ViewState";
import { AuxCoordSystemProps, AuxCoordSystem2dProps, AuxCoordSystem3dProps } from "./ElementProps";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Point3d, RotMatrix, Point2d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { IModel } from "./IModel";

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
  public isValidForView(view: ViewState): boolean {
    if (view.isSpatialView())
      return this instanceof AuxCoordSystemSpatialState;
    return (view.is3d() === this.is3d());
  }

  public abstract getOrigin(): Point3d;
  public abstract setOrigin(val: Point3d): void;
  public abstract getRotation(): RotMatrix;
  public abstract setRotation(val: RotMatrix): void;
  public is3d(): boolean { return this instanceof AuxCoordSystem3dState; }
}

export class AuxCoordSystem2dState extends AuxCoordSystemState implements AuxCoordSystem2dProps {
  public readonly origin = new Point2d();
  public angle: number;
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem2dProps, iModel: IModel) {
    super(props, iModel);
    this._rMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(this.angle))!;
  }

  public getOrigin(): Point3d { return Point3d.createFrom(this.origin); }
  public setOrigin(val: Point3d): void { this.origin.setFrom(val); }

  public getRotation(): RotMatrix { return this._rMatrix; }
  public setRotation(val: RotMatrix): void {
    this._rMatrix.setFrom(val);
    const ypr = YawPitchRollAngles.createFromRotMatrix(val)!;
    this.angle = ypr.yaw.radians;
  }
}

export class AuxCoordSystem3dState extends AuxCoordSystemState implements AuxCoordSystem3dProps {
  public readonly origin = new Point3d();
  public yaw: number;
  public pitch: number;
  public roll: number;
  private readonly _rMatrix: RotMatrix;

  constructor(props: AuxCoordSystem3dProps, iModel: IModel) {
    super(props, iModel);
    const angles = new YawPitchRollAngles(Angle.createRadians(this.yaw), Angle.createRadians(this.pitch), Angle.createRadians(this.roll));
    this._rMatrix = angles.toRotMatrix();
  }
  public getOrigin(): Point3d { return this.origin.clone(); }
  public setOrigin(val: Point3d): void { this.origin.setFrom(val); }
  public getRotation(): RotMatrix { return this._rMatrix; }
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
