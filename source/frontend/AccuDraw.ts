/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d, RotMatrix, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "./Viewport";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { Geometry } from "@bentley/geometry-core/lib/Geometry";
import { StandardViewId, standardViewMatrices } from "../common/ViewState";
import { ViewManager } from "./ViewManager";
import { ToolAdmin, CoordinateLockOverrides } from "./tools/ToolAdmin";
import { ColorDef, ColorRgb } from "../common/Render";
import { BeButtonEvent, CoordSource, BeModifierKey } from "./tools/Tool";
import { HitDetail, TentativeOrAccuSnap } from "./AccuSnap";
import { AuxCoordSystemState } from "../common/AuxCoordSys";
import { TentativePoint } from "./TentativePoint";

// tslint:disable:no-empty
export const enum AccuDrawFlags {
  SetModePolar = 1,
  SetModeRect = 1 << 1,
  SetOrigin = (1 << 2),
  FixedOrigin = (1 << 3),
  SetRMatrix = (1 << 4),
  SetXAxis = (1 << 5),
  SetNormal = (1 << 6),
  SetDistance = (1 << 7),
  LockDistance = (1 << 8),
  Lock_X = (1 << 9),
  Lock_Y = (1 << 10),
  Lock_Z = (1 << 11),
  Disable = (1 << 12),
  OrientDefault = (1 << 14),
  SetFocus = (1 << 15),
  OrientACS = (1 << 17),
  SetXAxis2 = (1 << 18),
  LockAngle = (1 << 19),
  AlwaysSetOrigin = SetOrigin | (1 << 21),
  RedrawCompass = (1 << 22),
  UpdateRotation = (1 << 23),
  SmartRotation = (1 << 24),
}

export const enum CompassMode {
  Polar = 0,
  Rectangular = 1,
}

export const enum RotationMode {
  Top = 1,
  Front = 2,
  Side = 3,
  View = 4,
  ACS = 5,
  Context = 6,
  Restore = 7,
}

const enum LockedStates {
  NONE_LOCKED = 0,
  X_BM = (1),
  Y_BM = (1 << 1),
  VEC_BM = (1 << 2),
  DIST_BM = (1 << 3),
  XY_BM = (X_BM | Y_BM),
  ANGLE_BM = (XY_BM | VEC_BM),
}

const enum CurrentState {
  NotEnabled = 0, // Compass disabled/unwanted for this session.
  Deactivated = 1, // Compass deactivated but CAN be activated by user.
  Inactive = 2, // Compass not displayed awaiting automatic activation (default tool state).
  Active = 3, // Compass displayed and adjusting points.
}

const enum ContextMode {
  Locked = 0,
  XAxis = 1,
  YAxis = 2,
  ZAxis = 3,
  XAxis2 = 4,
  None = 15,
}

export const enum ItemField {
  DIST_Item = 0,
  ANGLE_Item = 1,
  X_Item = 2,
  Y_Item = 3,
  Z_Item = 4,
}

export enum KeyinStatus {
  Dynamic = 0,
  Partial = 1,
  DontUpdate = 2,
}

enum Constants {
  MAX_SAVED_VALUES = 20,
  SMALL_ANGLE = 1.0e-12,
  SMALL_DELTA = 0.00001,
}

class AccudrawData {
  public flags: number;      // AccuDrawFlags OR'd together
  public readonly origin = new Point3d();     // used if ACCUDRAW_SetOrigin
  public readonly delta = new Point3d();      // if ACCUDRAW_Lock_X, etc.
  public readonly rMatrix = new RotMatrix();    // if ACCUDRAW_SetRMatrix/ACCUDRAW_Set3dMatrix
  public readonly vector = new Vector3d();     // if ACCUDRAW_SetXAxis, etc.
  public distance: number;   // if ACCUDRAW_SetDistance
  public angle: number;      // if ACCUDRAW_SetAngle
}

class Flags {
  public redrawCompass: boolean;
  public dialogNeedsUpdate: boolean;
  public rotationNeedsUpdate: boolean;
  public lockedRotation: boolean;
  public indexLocked: boolean;
  public haveValidOrigin: boolean;
  public fixedOrg: boolean;
  public auxRotationPlane: number;
  public contextRotMode: number;
  public baseRotation: number;
  public baseMode: number;
  public pointIsOnPlane: boolean;         // whether rawPointOnPlane is on compass plane
  public softAngleLock: boolean;          // don't remember what this was about...
  public bearingFixToPlane2D: boolean;
  public inDataPoint: boolean;
  public ignoreDataButton: boolean;
}

class RoundOff {
  public active: boolean;
  public units: number;
}

class SavedState {
  public state: CurrentState;
  public view: Viewport;
  public mode: CompassMode;
  public rotationMode: RotationMode;
  public readonly axes: Vector3d[] = [];
  public readonly origin = new Point3d();
  public auxRotationPlane: number;
  public contextRotMode: number;
  public fixedOrg: boolean;
  public ignoreDataButton: boolean; // Allow data point that terminates an input collector to be ignored...
}

class SavedCoords {
  public nSaveValues: number;
  public readonly savedValues: number[] = [];
  public readonly savedValIsAngle: boolean[] = [];
}

class ThreeAxes {
  public readonly x = new Vector3d();
  public readonly y = new Vector3d();
  public readonly z = new Vector3d();
  public setFrom(other: ThreeAxes) {
    this.x.setFrom(other.x);
    this.y.setFrom(other.y);
    this.z.setFrom(other.z);
  }
  public static fromRotMatrix(rMatrix: RotMatrix): ThreeAxes {
    const val = new ThreeAxes();
    rMatrix.getRow(0, val.x);
    rMatrix.getRow(1, val.y);
    rMatrix.getRow(2, val.z);
    return val;
  }
  public toRotMatrix(out?: RotMatrix) { return RotMatrix.createRows(this.x, this.y, this.z, out); }
}

/**
 * Accudraw is an aide for entering coordinate data
 */
export class AccuDraw {
  public static readonly instance = new AccuDraw();
  private currentState: CurrentState;     // Compass state
  private currentMode: CompassMode;      // Compass mode
  private rotationMode: RotationMode;     // Compass rotation
  private currentView?: Viewport;      // will be nullptr if view not yet defined
  private published: AccudrawData;        // Staging area for hints
  public readonly origin = new Point3d();    // origin point...not on compass plane when z != 0.0
  private readonly axes = new ThreeAxes();    // X, Y and Z vectors (3d rotation matrix)
  private readonly delta = new Vector3d();         // dialog items (x, y & z)
  private distance: number;         // current distance
  private angle: number;            // current angle
  private locked: number;           // axis/distance locked bit mask
  private indexed: number;          // axis/distance indexed bit mask
  private readonly distRndoff = new RoundOff();       // distance round off enabled and unit
  private readonly anglRndoff = new RoundOff();       // angle round off enabled and unit
  private readonly flags: Flags;            // current state flags
  private readonly fieldLocked: boolean[] = [];   // locked state of fields
  private readonly keyinStatus: KeyinStatus[] = [];   // state of input field
  private readonly savedState = new SavedState();       // Restore point for shortcuts/tools...
  private readonly savedCoords = new SavedCoords();      // History of previous angles/distances...
  private readonly baseAxes = new ThreeAxes();     // Used for "context" base rotation to hold arbitrary rotation w/o needing to change ACS...
  private readonly lastAxes = new ThreeAxes();      // Last result from UpdateRotation, replaces cM.rMatrix...
  private lastDistance: number;     // previous saved distance or distance indexing tick
  private tolerance: number;        // computed view based indexing tolerance
  private percentChanged: number;   // Compass animation state
  private threshold: number;        // Threshold for automatic x/y field focus change.
  private readonly planePt = new Point3d();          // same as origin unless non-zero locked z value
  private readonly rawDelta = new Point2d();         // used by rect fix point
  private readonly rawPoint = new Point3d();         // raw uor point passed to fix point
  private readonly rawPointOnPlane = new Point3d();  // adjusted rawPoint by applying hard/soft construction plane
  private readonly point = new Point3d();            // current cursor point
  private readonly vector = new Vector3d();           // current/last good locked direction
  private xIsNegative: boolean;      // Last delta.x was negative
  private yIsNegative: boolean;      // Last delta.y was negative
  private xIsExplicit: boolean;      // Sign of delta.x established from user input input, don't allow +/- side flip.
  private yIsExplicit: boolean;      // Sign of delta.y established from user input input, don't allow +/- side flip.
  private dontMoveFocus: boolean;    // Disable automatic focus change when user is entering input.
  private newFocus: ItemField;         // Item to move focus to (X_Item or Y_Item) for automatic focus change.
  private rMatrix = new RotMatrix();

  // Compass Display Preferences...
  protected compassSizeInches = 0.44;
  protected animationFrames = 12;
  protected frameColor = new ColorDef(ColorRgb.lightGrey);
  protected fillColor = new ColorDef(ColorRgb.blue);
  protected xColor = new ColorDef(ColorRgb.red);
  protected yColor = new ColorDef(ColorRgb.green);
  protected indexColor = new ColorDef(ColorRgb.white);

  // User Preference Settings...
  protected smartKeyin = true;
  protected floatingOrigin = true;
  protected stickyZLock = false;
  protected alwaysShowCompass = false;
  protected contextSensitive = true;
  protected axisIndexing = true;
  protected distanceIndexing = true;
  protected autoFocusFields = true;
  protected autoPointPlacement = false;

  private getCompassViewport(): Viewport | undefined { return this.currentView; }
  public getRotation(rMatrix?: RotMatrix): RotMatrix { if (!rMatrix) rMatrix = this.rMatrix; RotMatrix.createRows(this.axes.x, this.axes.y, this.axes.z, rMatrix); return rMatrix; }

  public getCompassMode() { return this.currentMode; }
  public isActive(): boolean { return CurrentState.Active === this.currentState; }
  public isEnabled(): boolean { return (this.currentState > CurrentState.NotEnabled); }
  public isInactive(): boolean { return (CurrentState.Inactive === this.currentState); }
  public isDeactivated(): boolean { return (CurrentState.Deactivated === this.currentState); }

  public activate(): void {
    // Upgrade state to inactive so OnBeginDynamics knows it's ok to move to active...
    if (CurrentState.Deactivated === this.currentState)
      this.currentState = CurrentState.Inactive;

    this.onBeginDynamics();
  }

  public deactivate() {
    this.onEndDynamics();
    // Don't allow compass to come back until user re-enables it...
    if (CurrentState.Inactive === this.currentState)
      this.currentState = CurrentState.Deactivated;
  }

  public setCompassMode(mode: CompassMode): void {
    if (mode === this.currentMode)
      return;

    this.currentMode = mode;
    this.onCompassModeChange();
  }

  public setRotationMode(mode: RotationMode): void {
    if (mode === this.rotationMode)
      return;

    this.rotationMode = mode;
    this.onRotationModeChange();
  }

  public setFieldLock(index: ItemField, locked: boolean): void {
    if (locked === this.fieldLocked[index])
      return;

    this.fieldLocked[index] = locked;
    this.onFieldLockChange(index);
  }

  public setKeyinStatus(index: ItemField, status: KeyinStatus): void {
    this.keyinStatus[index] = status;

    if (KeyinStatus.Dynamic !== status)
      this.dontMoveFocus = true;

    if (KeyinStatus.Partial === status)
      this.threshold = Math.abs(ItemField.X_Item === index ? this.rawDelta.y : this.rawDelta.x) + this.tolerance;
  }

  private setDefaultOrigin(vp: Viewport): void {
    if (!vp || this.locked || this.fieldLocked[ItemField.Z_Item])
      return;

    const view = vp.view;
    const rMatrix = view.getRotation();
    const acsOrigin = vp.getAuxCoordOrigin();
    rMatrix.multiply3dInPlace(acsOrigin);

    const origin = view.getCenter();
    view.getRotation().multiply3dInPlace(origin);
    origin.z = acsOrigin.z;
    view.getRotation().multiplyTranspose3dInPlace(origin);

    this.origin.setFrom(origin); // View center at acs z...
    this.planePt.setFrom(origin);
  }

  public isZLocked(vp: Viewport): boolean {
    if (this.fieldLocked[ItemField.Z_Item])
      return true;
    if (vp.isSnapAdjustmentRequired()) //  && TentativeOrAccuSnap.isHot())
      return true;

    return false;
  }

  private accountForAuxRotationPlane(rot: ThreeAxes, plane: RotationMode): void {
    // ACS mode now can have "front" and "side" variations...
    switch (plane) {
      case RotationMode.Top:
        return;

      case RotationMode.Front:
        const temp = rot.y.clone();
        rot.y.setFrom(rot.z);
        temp.scale(-1.0, rot.z);
        return;

      case RotationMode.Side:
        const temp0 = rot.x.clone();
        rot.x.setFrom(rot.y);
        rot.y.setFrom(rot.z);
        rot.z.setFrom(temp0);
    }
  }

  private accountForACSContextLock(vec: Vector3d): void {
    // Base rotation is relative to ACS when ACS context lock is enabled...
    if (!this.currentView || !this.currentView.isContextRotationRequired())
      return;

    const rMatrix = AccuDraw.getStandardRotation(StandardViewId.Top, this.currentView, true);
    rMatrix!.multiplyTranspose3dInPlace(vec);
  }

  private static useACSContextRotation(vp: Viewport, isSnap: boolean): boolean {
    if (isSnap) {
      if (!vp.isSnapAdjustmentRequired())
        return false;
    } else {
      if (!vp.isContextRotationRequired())
        return false;
    }
    return true;
  }

  public enableForSession(): void { if (CurrentState.NotEnabled === this.currentState) this.currentState = CurrentState.Inactive; }
  public disableForSession(): void {
    this.currentState = CurrentState.NotEnabled;
    this.flags.redrawCompass = true; // Make sure decorators are called so we don't draw (i.e. erase AccuDraw compass)
  }

  public setLastPoint(pt: Point3d): void {
    const vp = this.getCompassViewport();
    if (!vp)
      return;

    const ev = new BeButtonEvent();
    ev.initEvent(pt, pt, vp.worldToView(pt), vp, CoordSource.User, BeModifierKey.None);
    toolAdmin.setAdjustedDataPoint(ev);
  }

  public sendDataPoint(pt: Point3d, vp: Viewport): void {
    const ev = new BeButtonEvent();
    ev.initEvent(pt, pt, vp.worldToView(pt), vp, CoordSource.User, BeModifierKey.None);

    // Send both down and up events...
    toolAdmin.sendDataPoint(ev);
    ev.isDown = false;
    toolAdmin.sendDataPoint(ev);
  }

  public clearTentative(): boolean {
    if (!tentativePoint.m_isActive)
      return false;

    const wasSnapped = tentativePoint.isSnapped();
    tentativePoint.clear(true);
    return wasSnapped;
  }

  public doAutoPoint(index: ItemField, mode: CompassMode): void {
    const vp = this.getCompassViewport();
    if (!vp)
      return;

    if (CompassMode.Polar === mode) {
      if (!this.autoPointPlacement)
        return;

      if (this.fieldLocked[ItemField.DIST_Item] && (this.fieldLocked[ItemField.ANGLE_Item] || this.indexed & LockedStates.ANGLE_BM) && KeyinStatus.Dynamic === this.keyinStatus[index]) {
        this.fixPointPolar(vp);
        this.sendDataPoint(this.point, vp);
      }

      return;
    }

    if (this.fieldLocked[ItemField.X_Item] && this.fieldLocked[ItemField.Y_Item]) {
      if (!this.isActive()) {
        if (!vp.view.is3d() || this.fieldLocked[ItemField.Z_Item]) {
          const globalOrigin = new Point3d();

          if (vp.view.isSpatialView())
            globalOrigin.setFrom(vp.view.iModel.globalOrigin);

          this.sendDataPoint(globalOrigin.plus(this.delta), vp);
        }

        return;
      }

      if (!this.autoPointPlacement || KeyinStatus.Dynamic !== this.keyinStatus[index])
        return;

      this.origin.plus3Scaled(this.axes.x, this.delta.x, this.axes.y, this.delta.y, this.axes.z, this.delta.z, this.point);
      this.sendDataPoint(this.point, vp);
      return;
    }

    if (!this.autoPointPlacement || KeyinStatus.Dynamic !== this.keyinStatus[index])
      return;

    if ((ItemField.X_Item === index && this.fieldLocked[ItemField.X_Item] && (this.indexed & LockedStates.Y_BM)) || (ItemField.Y_Item === index && this.fieldLocked[ItemField.Y_Item] && (this.indexed & LockedStates.X_BM))) {
      this.origin.plus3Scaled(this.axes.x, this.delta.x, this.axes.y, this.delta.y, this.axes.z, this.delta.z, this.point);
      this.sendDataPoint(this.point, vp);
    }
  }

  private getValueByIndex(index: ItemField): number {
    switch (index) {
      case ItemField.X_Item: return this.delta.x;
      case ItemField.Y_Item: return this.delta.y;
      case ItemField.Z_Item: return this.delta.z;
      case ItemField.DIST_Item: return this.distance;
      case ItemField.ANGLE_Item: return this.angle;
      default:
        return 0.0;
    }
  }

  private setValueByIndex(index: ItemField, value: number): void {
    switch (index) {
      case ItemField.X_Item:
        this.delta.x = value;
        break;
      case ItemField.Y_Item:
        this.delta.y = value;
        break;
      case ItemField.Z_Item:
        this.delta.z = value;
        break;
      case ItemField.DIST_Item:
        this.distance = value;
        break;
      case ItemField.ANGLE_Item:
        this.angle = value;
        break;
    }
  }

  private updateVector(angle: number): void {
    this.vector.set(Math.cos(angle), Math.sin(angle), 0.0);
    const rMatrix = this.getRotation();
    rMatrix.multiplyTransposeVector(this.vector);
  }

  private stringToUORs(uors: number[], str: string): BentleyStatus {
    // DistanceParserPtr parser = DistanceParser:: Create();
    // DgnViewportP   vp = GetCompassViewport();

    // if (NULL == vp)
    //   parser = DistanceParser:: Create();
    //   else
    // parser = DistanceParser:: Create(* vp);

    // if (SUCCESS != parser -> ToValue(uors, str))
    //   return ERROR;

    return BentleyStatus.SUCCESS;
  }

  private stringToAngle(angle: number[], out: { isBearing: boolean }, inString: string, restrict: boolean): BentleyStatus {
    // WString     buffer(inString, BentleyCharEncoding:: Utf8);
    // WChar * p1, * p2, * string;
    // int         north = 0, east = 0;
    // bool        bearing = false;

    // if (isBearing)
    //       * isBearing = false;

    // string = buffer.begin();

    // if ((p1 = wcspbrk(string, L"NnSs")) != NULL) {
    //   string = p1 + 1;

    //   if ((p2 = wcspbrk(string, L"EeWw")) == NULL)
    //     return ERROR;

    //   north = (towupper(* p1) == L'N');
    //   east = (towupper(* p2) == L'E');
    //       * p2 = 0; // terminate string
    //   bearing = true;
    // }
    // else if (string[1] == L' ')
    // {
    //   bearing = true;

    //   switch (string[0]) {
    //     case L'1':
    //       north = true;
    //       east = true;
    //       break;
    //     case L'2':
    //       north = false;
    //       east = true;
    //       break;
    //     case L'3':
    //       north = false;
    //       east = false;
    //       break;
    //     case L'4':
    //       north = true;
    //       east = false;
    //       break;
    //     default:
    //       bearing = false;
    //       break;
    //   }

    //   if (bearing)
    //     string += 2;
    // }
    //   else
    // {
    //   bearing = false;
    // }

    // while (* string == L' ')
    // string++;

    // AngleParserPtr parser = AngleParser:: Create();

    // _SetupAngleParser(* parser);

    // if (SUCCESS != parser -> ToValue(angle, Utf8String(string).c_str()))
    //   return ERROR;

    // if (bearing) {
    //   if (north) {
    //     if (east)
    //       angle = 90.0 - angle;
    //     else
    //       angle = 90.0 + angle;
    //   }
    //   else {
    //     if (east)
    //       angle = 270.0 + angle;
    //     else
    //       angle = 270.0 - angle;
    //   }
    // }
    // else {
    //   DirectionFormatterPtr  formatter;

    //   DgnViewportP vp = GetCompassViewport();
    //   if (vp)
    //     formatter = DirectionFormatter:: Create(* vp -> GetViewController().GetTargetModel());
    //       else
    //   formatter = DirectionFormatter:: Create();

    //   if (DirectionMode:: Azimuth == formatter -> GetDirectionMode())
    //   {
    //     if (formatter -> GetClockwise())
    //       angle = formatter -> GetBaseDirection() - angle;
    //     else
    //       angle = angle - formatter -> GetBaseDirection();
    //   }
    // }

    // if (restrict == true) {
    //   while (angle >= 360.0)
    //     angle -= 360.0;

    //   while (angle < 0.0)
    //     angle += 360.0;
    // }

    // angle *= (msGeomConst_pi / 180.0);

    // if (isBearing)
    //       * isBearing = bearing;

    return BentleyStatus.SUCCESS;
  }

  private updateFieldValue(index: ItemField, input: string, out: { isBearing: boolean }): BentleyStatus {
    if (input.length === 0)
      return BentleyStatus.ERROR;

    if (input.length === 1)
      switch (input) {
        case ":":
        case "-":
        case "+":
        case ".":
          return BentleyStatus.ERROR;
      }

    switch (index) {
      case ItemField.DIST_Item:
        if (BentleyStatus.SUCCESS !== this.stringToUORs([this.distance], input))
          return BentleyStatus.ERROR;
        break;

      case ItemField.ANGLE_Item:
        if (BentleyStatus.SUCCESS !== this.stringToAngle([this.angle], out, input, true))
          return BentleyStatus.ERROR;
        break;

      case ItemField.X_Item:
        if (BentleyStatus.SUCCESS !== this.stringToUORs([this.delta.x], input))
          return BentleyStatus.ERROR;

        this.xIsExplicit = (input[0] === "+" || input[0] === "-");
        if (!this.xIsExplicit) {
          if (this.smartKeyin && this.isActive() && this.xIsNegative === (this.delta.x >= 0.0))
            this.delta.x = -this.delta.x;
        }
        break;

      case ItemField.Y_Item:
        if (BentleyStatus.SUCCESS !== this.stringToUORs([this.delta.y], input))
          return BentleyStatus.ERROR;

        this.yIsExplicit = (input[0] === "+" || input[0] === "-");
        if (!this.yIsExplicit) {
          if (this.smartKeyin && this.isActive() && this.yIsNegative === (this.delta.y >= 0.0))
            this.delta.y = -this.delta.y;
        }
        break;

      case ItemField.Z_Item:
        if (BentleyStatus.SUCCESS !== this.stringToUORs([this.delta.z], input))
          return BentleyStatus.ERROR;
        break;
    }

    return BentleyStatus.SUCCESS;
  }

  private unlockAllFields(): void {
    this.locked = 0;

    if (CompassMode.Polar === this.getCompassMode()) {
      if (this.fieldLocked[ItemField.DIST_Item])
        this.setFieldLock(ItemField.DIST_Item, false);

      if (this.fieldLocked[ItemField.ANGLE_Item])
        this.setFieldLock(ItemField.ANGLE_Item, false);
    } else {
      if (this.fieldLocked[ItemField.X_Item])
        this.setFieldLock(ItemField.X_Item, false);

      if (this.fieldLocked[ItemField.Y_Item])
        this.setFieldLock(ItemField.Y_Item, false);
    }

    if (this.fieldLocked[ItemField.Z_Item]) {
      if (this.stickyZLock)
        this.delta.z = 0.0;
      else
        this.setFieldLock(ItemField.Z_Item, false);
    }

    this.setKeyinStatus(ItemField.DIST_Item, KeyinStatus.Dynamic);
    this.setKeyinStatus(ItemField.ANGLE_Item, KeyinStatus.Dynamic);
    this.setKeyinStatus(ItemField.X_Item, KeyinStatus.Dynamic);
    this.setKeyinStatus(ItemField.Y_Item, KeyinStatus.Dynamic);
    this.setKeyinStatus(ItemField.Z_Item, KeyinStatus.Dynamic);

    if (!this.smartKeyin)
      this.setFocusItem(CompassMode.Polar === this.getCompassMode() ? ItemField.DIST_Item : ItemField.X_Item);

    this.dontMoveFocus = false;
  }

  /** produces the normal vector of the closest plane to the view vI which
   * contains *inVecP (uses true view rotation, never auxiliary)
   */
  private planeByVectorAndView(normalVec: Vector3d, inVec: Vector3d, vp: Viewport): boolean {
    if (!vp.view.is3d()) {
      normalVec.setFrom(Vector3d.unitZ());
      return true;
    }

    const viewNormal = vp.rotMatrix.getRow(2);
    const yVec = viewNormal.crossProduct(inVec);

    if (!yVec.normalizeInPlace()) {
      normalVec = viewNormal;
      return false;
    }

    inVec.crossProduct(yVec, normalVec);
    return true;
  }

  private handleDegeneratePolarCase(): void {
    if (!(this.locked & LockedStates.DIST_BM))
      this.distance = 0.0;

    if (this.locked & LockedStates.VEC_BM) {
      this.angle = Math.acos(this.vector.dotProduct(this.axes.x));
    } else if (this.locked & LockedStates.Y_BM) {
      this.vector.setFrom(this.axes.y);
      this.angle = Math.PI / 2.0;
      this.indexed = this.locked;
    } else if (this.locked & LockedStates.X_BM) {
      this.vector.setFrom(this.axes.x);
      this.angle = 0.0;
      this.indexed = this.locked;
    } else {
      // use last good vector
      this.angle = Math.acos(this.vector.dotProduct(this.axes.x));
    }
    this.origin.plusScaled(this.vector, this.distance, this.point);
  }

  private rawDeltaIsValid(vp: Viewport, rawDelta: number): boolean {
    /* Cursor Distance (*(+/-)) sense testing is not valid when raw delta is
       meaningless (0.0)...to make this change safer only reject the
       raw delta if unit or grid lock is also on. */
    if (0.0 !== rawDelta)
      return true;

    // The "I don't want grid lock" flag can be set by tools to override the default behavior...
    if (0 === (toolAdmin.toolState.coordLockOvr & CoordinateLockOverrides.OVERRIDE_COORDINATE_LOCK_Grid))
      return true;

    return (!toolAdmin.gridLock);
  }

  public processFieldInput(index: ItemField, input: string, synchText: boolean): void {
    const isBearing = false;

    if (BentleyStatus.SUCCESS !== this.updateFieldValue(index, input, { isBearing })) {
      const saveKeyinStatus = this.keyinStatus[index]; // Don't want this to change when entering '.', etc.
      this.updateFieldLock(index, false);
      this.keyinStatus[index] = saveKeyinStatus;
      return;
    }

    switch (index) {
      case ItemField.DIST_Item:
        this.distanceLock(synchText, true);
        this.doAutoPoint(index, CompassMode.Polar);
        break;

      case ItemField.ANGLE_Item:
        this.setFieldLock(index, true);

        if (synchText) {
          this.onFieldValueChange(index);
          this.setKeyinStatus(index, KeyinStatus.Dynamic);
        }

        if (!isBearing || !this.flags.bearingFixToPlane2D)
          this.updateVector(this.angle);
        else
          this.vector.set(Math.cos(this.angle), Math.sin(this.angle), 0.0);

        this.locked |= LockedStates.VEC_BM;
        this.doAutoPoint(index, CompassMode.Polar);
        break;

      case ItemField.X_Item:
      case ItemField.Y_Item:
        this.locked |= (ItemField.X_Item === index) ? LockedStates.X_BM : LockedStates.Y_BM;
      // Fall through...

      case ItemField.Z_Item:
        this.setFieldLock(index, true);
        if (synchText) {
          this.onFieldValueChange(index);
          this.setKeyinStatus(index, KeyinStatus.Dynamic);
        }

        this.doAutoPoint(index, this.getCompassMode());
        break;
    }

    this.refreshDecorationsAndDynamics();
  }

  public updateFieldLock(index: ItemField, locked: boolean): void {
    if (locked) {
      if (!this.fieldLocked[index]) {
        this.setFieldLock(index, true);

        switch (index) {
          case ItemField.DIST_Item:
            this.distanceLock(true, false);
            break;

          case ItemField.ANGLE_Item:
            this.angleLock();
            break;

          case ItemField.X_Item:
            this.locked |= LockedStates.X_BM;
            break;

          case ItemField.Y_Item:
            this.locked |= LockedStates.Y_BM;
            break;

          case ItemField.Z_Item:
            break;
        }
      }
      return;
    }

    switch (index) {
      case ItemField.DIST_Item:
        this.locked &= ~LockedStates.DIST_BM;
        break;

      case ItemField.ANGLE_Item:
        this.locked &= ~LockedStates.VEC_BM;
        break;

      case ItemField.X_Item:
        this.locked &= ~LockedStates.X_BM;
        break;

      case ItemField.Y_Item:
        this.locked &= ~LockedStates.Y_BM;
        break;
    }

    if (index !== ItemField.Z_Item || !this.stickyZLock)
      this.setFieldLock(index, false);

    this.setKeyinStatus(index, KeyinStatus.Dynamic);
  }

  private static getStandardRotation(nStandard: StandardViewId, vp: Viewport | undefined, useACS: boolean): RotMatrix | undefined {
    if (nStandard < StandardViewId.Top || nStandard > StandardViewId.RightIso)
      return undefined;

    const rMatrix = standardViewMatrices[nStandard].clone();
    if (!useACS)
      return rMatrix;

    const useVp = vp ? vp : viewManager.selectedView;
    if (!useVp)
      return undefined;

    rMatrix.multiplyMatrixMatrix(useVp.getAuxCoordRotation(AccuDraw.tempRot), rMatrix);
    return rMatrix;
  }

  private static getCurrentOrientation(vp: Viewport, checkAccuDraw: boolean, checkACS: boolean, rMatrix?: RotMatrix): RotMatrix | undefined {
    if (checkAccuDraw && accuDraw.isActive())
      return accuDraw.getRotation(rMatrix);

    const useVp = vp ? vp : viewManager.selectedView;
    if (!useVp)
      return RotMatrix.createIdentity(rMatrix);

    if (checkACS && useVp.isContextRotationRequired())
      return useVp.getAuxCoordRotation(rMatrix);

    return useVp.rotMatrix;
  }

  private getHitDetailRotation(rMatrix: RotMatrix, hit: HitDetail): boolean {
    // DPoint3d                origin;
    // RotateToElemToolHelper  rotateHelper;

    // return rotateHelper.GetOrientation(hit, origin, rMatrix);
    return false;
  }

  public static updateAuxCoordinateSystem(acs: AuxCoordSystemState, vp: Viewport, allViews: boolean): void {
    // When modeling with multiple spatial views open, you'd typically want the same ACS in all views...
    if (allViews && vp.view.isSpatialView()) {
      for (const otherVp of viewManager.viewports) {
        if (otherVp !== vp && otherVp.view.isSpatialView())
          otherVp.auxCoordSystem = acs;
      }
    }

    vp.auxCoordSystem = acs;

    // NOTE: Change AccuDraw's base rotation to ACS.
    accuDraw.setContext(AccuDrawFlags.OrientACS);
  }

  private distanceLock(synchText: boolean, saveInHistory: boolean): void {
    this.locked |= LockedStates.DIST_BM;

    if (!this.fieldLocked[ItemField.DIST_Item])
      this.setFieldLock(ItemField.DIST_Item, true);

    if (saveInHistory)
      this.saveCoordinate(ItemField.DIST_Item, this.distance);

    if (synchText) {
      this.onFieldValueChange(ItemField.DIST_Item);
      this.setKeyinStatus(ItemField.DIST_Item, KeyinStatus.Dynamic);
    }
  }

  private angleLock(): void {
    if (this.indexed & LockedStates.Y_BM)
      this.locked |= LockedStates.Y_BM;
    else if (this.indexed & LockedStates.X_BM)
      this.locked |= LockedStates.X_BM;
    else
      this.locked |= LockedStates.VEC_BM;

    this.clearTentative();

    if (!this.fieldLocked[ItemField.ANGLE_Item]) {
      this.setFieldLock(ItemField.ANGLE_Item, true);
      this.setKeyinStatus(ItemField.ANGLE_Item, KeyinStatus.Dynamic);
    }

    this.flags.lockedRotation = true;
    this.flags.softAngleLock = false;
  }

  private doLockAngle(isSnapped: boolean): void {
    if (CompassMode.Polar !== this.getCompassMode()) {
      this.locked = LockedStates.NONE_LOCKED;
      this.rawPoint.setFrom(this.point);

      const vp = this.getCompassViewport();
      if (vp)
        this.fixPointPolar(vp);

      this.changeCompassMode(true);
    }

    this.setFieldLock(ItemField.ANGLE_Item, !this.fieldLocked[ItemField.ANGLE_Item]);

    if (this.fieldLocked[ItemField.ANGLE_Item]) {
      // Move focus to angle field...
      if (!isSnapped && this.autoFocusFields)
        this.setFocusItem(ItemField.ANGLE_Item);

      this.angleLock();

      if (!isSnapped)
        this.flags.softAngleLock = true;
    } else {
      this.locked &= ~LockedStates.ANGLE_BM;
      this.saveCoordinate(ItemField.ANGLE_Item, this.angle);
    }
  }

  private saveCoordinate(index: ItemField, value: number): void {
    const isAngle = (ItemField.ANGLE_Item === index);
    let currIndex = this.savedCoords.nSaveValues + 1;

    if (currIndex >= Constants.MAX_SAVED_VALUES)
      currIndex = 0;

    if (this.savedCoords.savedValues[this.savedCoords.nSaveValues] === value && this.savedCoords.savedValIsAngle[this.savedCoords.nSaveValues] === isAngle)
      return;

    if (isAngle) {
      // don't accept 0, 90, -90, and 180 degrees
      if (value === 0.0 || value === Math.PI || value === (Math.PI / 2.0) || value === -Math.PI)
        return;
    } else {
      // don't accept zero
      value = Math.abs(value);
      if (value < Constants.SMALL_ANGLE)
        return;
    }

    this.savedCoords.savedValues[currIndex] = value;
    this.savedCoords.savedValIsAngle[currIndex] = isAngle;
    this.savedCoords.nSaveValues = currIndex;

    if (!isAngle)
      this.lastDistance = value;
  }

  private changeCompassMode(animate: boolean): void {
    this.setCompassMode(CompassMode.Polar === this.getCompassMode() ? CompassMode.Rectangular : CompassMode.Polar);

    const viewport = this.currentView;
    if (!animate || !this.animateCompassChanges() || !viewport)
      return;

    // AccuDrawAnimatorPtr animator = AccuDrawAnimator:: Create();
    // viewport.setAnimator(* animator);
    // animator -> ChangeOfMode();
  }

  private changeRotationMode(mode: RotationMode): void {
    this.changeBaseRotationMode(mode);
    this.setRotationMode(mode);
    this.updateRotation();
  }

  private changeBaseMode(mode: CompassMode) { this.flags.baseMode = mode; }

  private changeBaseRotationMode(mode: RotationMode): void {
    if (mode > RotationMode.Context)
      return;

    if (RotationMode.Context === mode) {
      // See if it's better to stay with the current base rotation (only care about z)...
      if (RotationMode.Context !== this.flags.baseRotation) {
        const baseRMatrix = this.getBaseRotation();
        const baseZ = baseRMatrix.getRow(2);

        if (baseZ.isParallelTo(this.axes.z))
          return;
      }

      this.baseAxes.setFrom(this.axes);
      this.flags.auxRotationPlane = RotationMode.Top;
    }

    this.flags.baseRotation = mode;
  }

  private getBaseRotation(): RotMatrix {
    const vp = this.currentView;
    let baseRMatrix: RotMatrix | undefined;
    const useAcs = vp ? vp.isContextRotationRequired() : false;
    switch (this.flags.baseRotation) {
      case RotationMode.Top: {
        baseRMatrix = AccuDraw.getStandardRotation(StandardViewId.Top, vp, useAcs)!;
        break;
      }

      case RotationMode.Front: {
        baseRMatrix = AccuDraw.getStandardRotation(StandardViewId.Front, vp, useAcs)!;
        break;
      }

      case RotationMode.Side: {
        baseRMatrix = AccuDraw.getStandardRotation(StandardViewId.Right, vp, useAcs)!;
        break;
      }

      case RotationMode.ACS: {
        baseRMatrix = vp ? vp.getAuxCoordRotation() : RotMatrix.createIdentity();
        const axes = ThreeAxes.fromRotMatrix(baseRMatrix);
        this.accountForAuxRotationPlane(axes, this.flags.auxRotationPlane);
        axes.toRotMatrix(baseRMatrix);
        break;
      }

      case RotationMode.View: {
        baseRMatrix = vp ? vp.rotMatrix : RotMatrix.createIdentity();
        break;
      }

      case RotationMode.Context: {
        const axes = new ThreeAxes();
        axes.setFrom(this.baseAxes);
        this.accountForAuxRotationPlane(axes, this.flags.auxRotationPlane);
        baseRMatrix = axes.toRotMatrix();
        break;
      }

      default: {
        baseRMatrix = RotMatrix.createIdentity();
        break;
      }
    }
    return baseRMatrix;
  }

  private onEventCommon(): void {
    if (this.published.flags & AccuDrawFlags.RedrawCompass) {
      this.flags.indexLocked = true;
      this.flags.redrawCompass = true;
    }

    if (this.published.flags & AccuDrawFlags.UpdateRotation) {
      this.flags.indexLocked = true;
      this.flags.contextRotMode = ContextMode.XAxis;
      this.setRotationMode(RotationMode.Context);
      this.updateRotation();
      this.flags.indexLocked = true;
    }
  }

  private saveLockedCoords(): void {
    if (CompassMode.Polar === this.currentMode) {
      if (this.fieldLocked[ItemField.DIST_Item])
        this.saveCoordinate(ItemField.DIST_Item, this.distance);

      if (this.fieldLocked[ItemField.ANGLE_Item])
        this.saveCoordinate(ItemField.ANGLE_Item, this.angle);
    } else {
      if (this.fieldLocked[ItemField.X_Item])
        this.saveCoordinate(ItemField.X_Item, this.delta.x);

      if (this.fieldLocked[ItemField.Y_Item])
        this.saveCoordinate(ItemField.Y_Item, this.delta.y);
    }

    const vp = this.getCompassViewport();

    if (vp && vp.view.is3d()) {
      if (this.fieldLocked[ItemField.Z_Item])
        this.saveCoordinate(ItemField.Z_Item, this.delta.z);
    }
  }

  private getSavedValue(index: ItemField, next: boolean): void {
    let i = 0;
    let status = BentleyStatus.ERROR;
    const isAngle = (ItemField.ANGLE_Item === index);
    let value = 0.0;
    const currValue = this.getValueByIndex(index);

    for (; ;) {
      value = this.savedCoords.savedValues[this.savedCoords.nSaveValues];
      if (value > Constants.SMALL_ANGLE && this.savedCoords.savedValIsAngle[this.savedCoords.nSaveValues] === isAngle && value !== currValue)
        status = BentleyStatus.SUCCESS;

      if (next) {
        this.savedCoords.nSaveValues++;

        if (this.savedCoords.nSaveValues >= Constants.MAX_SAVED_VALUES)
          this.savedCoords.nSaveValues = 0;
      } else {
        this.savedCoords.nSaveValues--;

        if (this.savedCoords.nSaveValues < 0)
          this.savedCoords.nSaveValues = Constants.MAX_SAVED_VALUES - 1;
      }

      if (BentleyStatus.SUCCESS === status)
        break;

      if (i++ >= Constants.MAX_SAVED_VALUES)
        return; // went full circle unsuccessfully
    }

    this.lastDistance = value;

    if (currValue < 0.0)
      value = -value;

    this.setValueByIndex(index, value);

    switch (index) {
      case ItemField.X_Item:
        this.setFieldLock(ItemField.X_Item, true);
        this.onFieldValueChange(ItemField.X_Item);
        this.locked |= LockedStates.X_BM;
        break;

      case ItemField.Y_Item:
        this.setFieldLock(ItemField.Y_Item, true);
        this.onFieldValueChange(ItemField.Y_Item);
        this.locked |= LockedStates.Y_BM;
        break;

      case ItemField.Z_Item:
        this.setFieldLock(ItemField.Z_Item, true);
        this.onFieldValueChange(ItemField.Z_Item);
        break;

      case ItemField.DIST_Item:
        this.distanceLock(true, false);
        break;

      case ItemField.ANGLE_Item:
        this.locked &= ~LockedStates.XY_BM;
        this.updateVector(this.angle);
        this.angleLock();
        break;
    }
  }
  private choosePreviousValue(index: ItemField): void { this.getSavedValue(index, false); }
  private chooseNextValue(index: ItemField): void { this.getSavedValue(index, true); }

  protected onCompassModeChange(): void { }
  protected onRotationModeChange(): void { }
  protected onFieldLockChange(_index: ItemField) { }
  protected onFieldValueChange(_index: ItemField) { }
  protected hasInputFocus() { return true; }
  protected gGrabInputFocus() { }
  protected setFocusItem(_index: ItemField) { }

  private static getMinPolarMag(origin: Point3d): number {
    return (1.0e-12 * (1.0 + origin.magnitude()));
  }

  /** projects cursor onto plane in view, or returns an error */
  private constructionPlane(outPtP: Point3d, inPtP: Point3d, pointOnPlaneP: Point3d, normalVectorP: Vector3d, vp: Viewport, perpendicular: boolean): BentleyStatus {
    let fromPtP: Point3d;
    let dotProduct: number;
    let distance: number;
    let projectionVector = new Vector3d();

    if (perpendicular) {
      if (AccuDraw.useACSContextRotation(vp, true)) { // Project along ACS axis to AccuDraw plane...
        const rMatrix = vp.getAuxCoordRotation(AccuDraw.tempRot);
        const axes = ThreeAxes.fromRotMatrix(rMatrix);
        this.accountForAuxRotationPlane(axes, this.flags.auxRotationPlane);
        // LegacyMath:: Vec:: LinePlaneIntersect(outPtP, inPtP, axes.z, pointOnPlaneP, normalVectorP, false);
      } else {
        projectionVector = inPtP.vectorTo(pointOnPlaneP);
        distance = projectionVector.dotProduct(normalVectorP);
        inPtP.plusScaled(normalVectorP, distance, outPtP);
      }
    } else {
      const isCamera = vp.isCameraOn();
      if (vp.view.is3d() && isCamera) {
        const cameraPos = vp.view.getEyePoint();
        fromPtP = cameraPos;
        fromPtP.vectorTo(inPtP, projectionVector).normalizeInPlace();
      } else {
        const rMatrix = vp.rotMatrix;
        fromPtP = inPtP;
        rMatrix.getRow(2, projectionVector);
      }

      dotProduct = projectionVector.dotProduct(normalVectorP);

      if (Math.abs(dotProduct) < Constants.SMALL_DELTA)
        return BentleyStatus.ERROR; // PARALLEL;

      distance = (normalVectorP.dotProduct(pointOnPlaneP) - normalVectorP.dotProduct(fromPtP)) / dotProduct;

      if (isCamera && distance < Constants.SMALL_DELTA)
        return BentleyStatus.ERROR; // BEHIND_EYE_POINT;

      fromPtP.plusScaled(projectionVector, distance, outPtP);
    }

    return BentleyStatus.SUCCESS;
  }

  private softConstructionPlane(outPtP: Point3d, inPtP: Point3d, pointOnPlaneP: Point3d, normalVectorP: Vector3d, vp: Viewport, isSnap: boolean): boolean {
    if (!vp.isPointAdjustmentRequired()) {
      outPtP.setFrom(inPtP);
      return true;
    }

    if (isSnap) {
      outPtP.setFrom(inPtP);
      const delta = pointOnPlaneP.vectorTo(outPtP);
      return (Math.abs(normalVectorP.dotProduct(delta)) < Constants.SMALL_DELTA);
    } else if (BentleyStatus.SUCCESS !== this.constructionPlane(outPtP, inPtP, pointOnPlaneP, normalVectorP, vp, false)) {
      const viewNormal = vp.rotMatrix.getRow(2);
      this.constructionPlane(outPtP, inPtP, pointOnPlaneP, viewNormal, vp, false);
      this.constructionPlane(outPtP, outPtP, pointOnPlaneP, normalVectorP, vp, true);

      return false;
    }
    return true;
  }

  /** snap projects normal, always produces point */
  private hardConstructionPlane(outPtP: Point3d, inPtP: Point3d, pointOnPlaneP: Point3d, normalVectorP: Vector3d, vp: Viewport, isSnap: boolean): boolean {
    if (!vp.isPointAdjustmentRequired()) {
      outPtP.setFrom(inPtP);
      return true;
    }

    if (BentleyStatus.SUCCESS !== this.constructionPlane(outPtP, inPtP, pointOnPlaneP, normalVectorP, vp, isSnap)) {
      const viewNormal = vp.rotMatrix.getRow(2);
      this.constructionPlane(outPtP, inPtP, pointOnPlaneP, viewNormal, vp, false);
      this.constructionPlane(outPtP, outPtP, pointOnPlaneP, normalVectorP, vp, true);
    }

    return true;
  }

  private static allowAxisIndexing(pointIsOnPlane: boolean): boolean {
    // NOTE: Normally we don't want indexing overriding a hot snap location. The
    //       exception to this is nearest snap. If the nearest snap is in the plane
    //       of the AccuDraw compass, it's confusing not having axis indexing.
    if (!TentativeOrAccuSnap.isHot())
      return true;

    if (!pointIsOnPlane)
      return false;

    // SnapDetailCP snapDetail = AccuSnap:: GetInstance().GetCurrSnapDetail();
    // if (nullptr == snapDetail || SnapMode:: Nearest != snapDetail -> GetSnapMode())
    // return false;

    return true;
  }

  public fixPointPolar(vp: Viewport): void {
    let angleChanged = false;
    let distChanged = false;
    const zLocked = this.isZLocked(vp);
    const xyCorrection = new Point3d();

    this.planePt.setFrom(this.origin);

    if (zLocked && !(this.delta.z < Constants.SMALL_ANGLE && this.delta.z > -Constants.SMALL_ANGLE))
      this.planePt.addScaledInPlace(this.axes.z, this.delta.z);

    // if (this.locked & LockedStates.VEC_BM) {
    //   if (!TentativeOrAccuSnap.isHot())      {
    //     DVec3d    normVec;
    //     this.planeByVectorAndView(normVec, this.vector, vp);
    //     this.softConstructionPlane(& this.rawPointOnPlane, & this.rawPoint, & this.planePt, & normVec, vp, false);
    //   } else
    //   {
    //     this.rawPointOnPlane.setFrom(this.rawPoint);
    //     this.flags.pointIsOnPlane = false;
    //   }
    // } else {
    //   if (zLocked) {
    //     this.hardConstructionPlane(& this.rawPointOnPlane, & this.rawPoint, & this.planePt, & this.axes.z, vp, TentativeOrAccuSnap.isHot());
    //     this.flags.pointIsOnPlane = true;
    //   } else {
    //     this.flags.pointIsOnPlane = (this.softConstructionPlane(& this.rawPointOnPlane, & this.rawPoint, & this.planePt, & this.axes.z, vp, TentativeOrAccuSnap.isHot()) || this.locked & XY_BM);
    //   }
    // }

    let delta: Vector3d;
    if (zLocked)
      delta = this.planePt.vectorTo(this.rawPointOnPlane);
    else
      delta = this.origin.vectorTo(this.rawPointOnPlane);

    const minPolarMag = AccuDraw.getMinPolarMag(this.origin);

    let mag: number;
    if (this.locked & LockedStates.VEC_BM) {
      mag = delta.dotProduct(this.vector);
      xyCorrection.x -= delta.x - mag * this.vector.x;
      xyCorrection.y -= delta.y - mag * this.vector.y;
      xyCorrection.z -= delta.z - mag * this.vector.z;
      this.vector.scale(mag, delta);
      if (mag < 0.0)
        mag = -mag;
      if (mag < minPolarMag) {
        this.handleDegeneratePolarCase();
        return;
      }

      this.flags.pointIsOnPlane = (Math.abs(this.axes.z.dotProduct(delta)) < Constants.SMALL_DELTA);
    } else {
      mag = delta.magnitude();
      if (mag < minPolarMag) {
        this.handleDegeneratePolarCase();
        return;
      }
    }

    const newPt = this.rawPointOnPlane.plus(xyCorrection);
    xyCorrection.setZero();

    // measure angle
    const rotVec = new Point3d();
    rotVec.x = this.axes.x.dotProduct(delta);

    // NOTE: Always return angle relative to compass plane...used to return "angle out of plane" for points off plane.
    rotVec.y = this.axes.y.dotProduct(delta);
    this.angle = Math.atan2(rotVec.y, rotVec.x);

    // constrain angle
    if (this.flags.pointIsOnPlane && !(this.locked & LockedStates.VEC_BM)) {
      if (!TentativeOrAccuSnap.isHot() && this.anglRndoff.active) {
        this.angle = this.anglRndoff.units * Math.floor((this.angle / this.anglRndoff.units) + 0.5);

        xyCorrection.x += Math.cos(this.angle) * mag - rotVec.x;
        xyCorrection.y += Math.sin(this.angle) * mag - rotVec.y;

        rotVec.x = Math.cos(this.angle) * mag;
        rotVec.y = Math.sin(this.angle) * mag;

        angleChanged = true;
      }

      if (this.locked & LockedStates.X_BM || (AccuDraw.allowAxisIndexing(this.flags.pointIsOnPlane) && (rotVec.x < this.tolerance && rotVec.x > - this.tolerance) && !this.flags.indexLocked && this.axisIndexing)) {
        this.indexed |= LockedStates.X_BM; // indexed in X

        xyCorrection.x -= rotVec.x;
        rotVec.x = 0.0;

        if (TentativeOrAccuSnap.isHot())
          xyCorrection.z -= delta.dotProduct(this.axes.z);

        this.angle = (rotVec.y < 0.0) ? -Math.PI / 2.0 : Math.PI / 2.0;
        angleChanged = true;
      }

      if (this.locked & LockedStates.Y_BM || (AccuDraw.allowAxisIndexing(this.flags.pointIsOnPlane) && (rotVec.y < this.tolerance && rotVec.y > -this.tolerance) && !this.flags.indexLocked && this.axisIndexing)) {
        if (this.indexed & LockedStates.X_BM) { // both indexed
          this.handleDegeneratePolarCase();
          return;
        }

        this.indexed |= LockedStates.Y_BM; // indexed in Y
        xyCorrection.y -= rotVec.y;

        if (TentativeOrAccuSnap.isHot())
          xyCorrection.z -= delta.dotProduct(this.axes.z);

        rotVec.y = 0.0;
        this.angle = (rotVec.x < 0.0) ? Math.PI : 0.0;
        angleChanged = true;
      }

      if (angleChanged) {
        delta.addScaledInPlace(this.axes.x, rotVec.x);
        delta.addScaledInPlace(this.axes.y, rotVec.y);
        mag = delta.magnitude();
        if (mag < minPolarMag) {
          this.handleDegeneratePolarCase();
          return;
        }
      }
    }

    // constrain distance
    const oldMag = mag;

    if (this.locked & LockedStates.DIST_BM) { // distance locked
      mag = this.distance;
      distChanged = true;
      this.indexed &= ~LockedStates.DIST_BM;
    } else if (!TentativeOrAccuSnap.isHot()) { // if non-snap, try rounding and aligning
      if (this.distRndoff.active) {
        mag = this.distRndoff.units * Math.floor((mag / this.distRndoff.units) + 0.5);
        distChanged = true;
      }

      if (Geometry.isDistanceWithinTol(mag - this.lastDistance, this.tolerance) && !this.flags.indexLocked && this.distanceIndexing) {
        this.indexed |= LockedStates.DIST_BM; // distance indexed
        mag = this.lastDistance;
        distChanged = true;
      }
    }

    // project to corrected point
    newPt.plus3Scaled(this.axes.x, xyCorrection.x, this.axes.y, xyCorrection.y, this.axes.z, xyCorrection.z, newPt);

    // display index highlight even if snapped
    if (TentativeOrAccuSnap.isHot() && this.flags.pointIsOnPlane) {
      if (Math.abs(rotVec.x) < Constants.SMALL_ANGLE)
        this.indexed |= LockedStates.X_BM;
      else if (Math.abs(rotVec.y) < Constants.SMALL_ANGLE)
        this.indexed |= LockedStates.Y_BM;
    }

    if (distChanged) {
      if (mag < minPolarMag && mag > -minPolarMag) {
        this.handleDegeneratePolarCase();
        return;
      }

      // adjust corrected point for distance indexing
      newPt.addScaledInPlace(delta, mag / oldMag - 1.0);
      delta.scaleInPlace(mag / oldMag);
    }

    // save corrected point
    this.point.setFrom(newPt);

    // finish up
    this.distance = mag;

    if (!(this.locked & LockedStates.VEC_BM))
      delta.scale(1.0 / mag, this.vector);

    if (this.locked & LockedStates.XY_BM)
      this.indexed |= this.locked;

    if (!zLocked)
      this.delta.z = (this.flags.pointIsOnPlane) ? 0.0 : delta.dotProduct(this.axes.z);
  }

  private fixPointRectangular(vp: Viewport): void {
    const zLocked = this.isZLocked(vp);
    const xyCorrection = new Vector3d();

    this.planePt.setFrom(this.origin);
    this.indexed = 0;

    if (zLocked) {
      this.flags.pointIsOnPlane = (this.delta.z < Constants.SMALL_ANGLE && this.delta.z > -Constants.SMALL_ANGLE);
      if (!this.flags.pointIsOnPlane)
        this.planePt.addScaledInPlace(this.axes.z, this.delta.z);
      this.hardConstructionPlane(this.rawPointOnPlane, this.rawPoint, this.planePt, this.axes.z, vp, TentativeOrAccuSnap.isHot());
    } else {
      this.flags.pointIsOnPlane = this.softConstructionPlane(this.rawPointOnPlane, this.rawPoint, this.origin, this.axes.z, vp, TentativeOrAccuSnap.isHot());
    }

    const trueDelta = this.origin.vectorTo(this.rawPointOnPlane);
    this.rawDelta.x = trueDelta.dotProduct(this.axes.x);
    this.xIsNegative = (this.rawDelta.x < -Constants.SMALL_ANGLE);

    this.rawDelta.y = trueDelta.dotProduct(this.axes.y);
    this.yIsNegative = (this.rawDelta.y < -Constants.SMALL_ANGLE);

    if (!zLocked)
      this.delta.z = (this.flags.pointIsOnPlane) ? 0.0 : trueDelta.dotProduct(this.axes.z);

    if (AccuDraw.allowAxisIndexing(this.flags.pointIsOnPlane)) {
      if (!(this.locked & LockedStates.X_BM)) { // not locked in x
        if (this.distRndoff.active) { // round x
          xyCorrection.x = this.distRndoff.units * Math.floor((this.rawDelta.x / this.distRndoff.units) + 0.5) - this.rawDelta.x;
          this.rawDelta.x = this.distRndoff.units * Math.floor((this.rawDelta.x / this.distRndoff.units) + 0.5);
        }

        if (this.rawDelta.x < this.tolerance && this.rawDelta.x > -this.tolerance &&
          !this.flags.indexLocked && this.axisIndexing) { // index x
          this.indexed |= LockedStates.X_BM; // indexed in X
          xyCorrection.x -= this.rawDelta.x;
          this.rawDelta.x = 0.0;
        }
      }
      if (!(this.locked & LockedStates.Y_BM)) {
        if (this.distRndoff.active) { // round y
          xyCorrection.y = this.distRndoff.units * Math.floor((this.rawDelta.y / this.distRndoff.units) + 0.5) - this.rawDelta.y;
          this.rawDelta.y = this.distRndoff.units * Math.floor((this.rawDelta.y / this.distRndoff.units) + 0.5);
        }

        if (this.rawDelta.y < this.tolerance && this.rawDelta.y > -this.tolerance &&
          !this.flags.indexLocked && this.axisIndexing) { // index y
          this.indexed |= LockedStates.Y_BM; // indexed in Y
          xyCorrection.y -= this.rawDelta.y;
          this.rawDelta.y = 0.0;
        }
      }
    }

    if (this.locked & LockedStates.X_BM) {
      if (this.rawDeltaIsValid(vp, this.rawDelta.x)) {
        // cursor changed sides, reverse value
        if ((this.delta.x < -Constants.SMALL_ANGLE) !== this.xIsNegative &&
          this.smartKeyin && this.keyinStatus[ItemField.X_Item] === KeyinStatus.Partial &&
          !this.xIsExplicit)
          this.delta.x = -this.delta.x;
      }

      xyCorrection.x = this.delta.x - this.rawDelta.x;
    } else {
      const lastDist = (this.rawDelta.x < 0.0) ? (-this.lastDistance) : this.lastDistance;

      if (!TentativeOrAccuSnap.isHot() && ((this.locked & LockedStates.Y_BM) || (this.indexed & LockedStates.Y_BM)) && !(this.indexed & LockedStates.X_BM) &&
        Geometry.isDistanceWithinTol(this.rawDelta.x - lastDist, this.tolerance) &&
        !this.flags.indexLocked && this.distanceIndexing) {
        xyCorrection.x += lastDist - this.rawDelta.x;
        this.delta.x = lastDist;
        this.indexed |= LockedStates.DIST_BM;
      } else {
        this.delta.x = this.rawDelta.x;
      }
    }

    if (this.locked & LockedStates.Y_BM) {
      if (this.rawDeltaIsValid(vp, this.rawDelta.y)) {
        // cursor changed sides, reverse value
        if ((this.delta.y < -Constants.SMALL_ANGLE) !== this.yIsNegative &&
          this.smartKeyin && this.keyinStatus[ItemField.Y_Item] === KeyinStatus.Partial &&
          !this.yIsExplicit)
          this.delta.y = -this.delta.y;
      }

      xyCorrection.y = this.delta.y - this.rawDelta.y;
    } else {
      const lastDist = (this.rawDelta.y < Constants.SMALL_ANGLE) ? - this.lastDistance : this.lastDistance;

      if (!TentativeOrAccuSnap.isHot() && ((this.locked & LockedStates.X_BM) || (this.indexed & LockedStates.X_BM)) && !(this.indexed & LockedStates.Y_BM) &&
        Geometry.isDistanceWithinTol(this.rawDelta.y - lastDist, this.tolerance) &&
        !this.flags.indexLocked && this.distanceIndexing) {
        xyCorrection.y += lastDist - this.rawDelta.y;
        this.delta.y = lastDist;
        this.indexed |= LockedStates.DIST_BM;
      } else {
        this.delta.y = this.rawDelta.y;
      }
    }

    this.rawPointOnPlane.plus2Scaled(this.axes.x, xyCorrection.x, this.axes.y, xyCorrection.y, this.point);

    if (zLocked && !this.flags.pointIsOnPlane)
      this.hardConstructionPlane(this.point, this.point, this.planePt, this.axes.z, vp, TentativeOrAccuSnap.isHot());

    if ((this.locked & LockedStates.X_BM && this.delta.x === 0.0) || (this.locked & LockedStates.Y_BM && this.delta.y === 0.0)) {
      this.indexed |= this.locked; // to display index highlight
    } else if (TentativeOrAccuSnap.isHot()) {
      if (Math.abs(this.delta.x) < Constants.SMALL_ANGLE)
        this.indexed |= LockedStates.X_BM;
      else if (Math.abs(this.delta.y) < Constants.SMALL_ANGLE)
        this.indexed |= LockedStates.Y_BM;
    }

    const lock = this.locked & LockedStates.XY_BM;
    const index = this.indexed & LockedStates.XY_BM;

    if (lock === LockedStates.Y_BM && index !== LockedStates.X_BM) {
      if (this.keyinStatus[ItemField.Y_Item] !== KeyinStatus.Dynamic) {
        if (Math.abs(this.rawDelta.x) < this.threshold)
          return;
      }

      this.newFocus = ItemField.X_Item;
      this.dontMoveFocus = false;
    } else if (lock === LockedStates.X_BM && index !== LockedStates.Y_BM) {
      if (this.keyinStatus[ItemField.X_Item] !== KeyinStatus.Dynamic) {
        if (Math.abs(this.rawDelta.y) < this.threshold)
          return;
      }

      this.newFocus = ItemField.Y_Item;
      this.dontMoveFocus = false;
    } else {
      this.newFocus = ((Math.abs(this.rawDelta.x) > Math.abs(this.rawDelta.y)) ? ItemField.X_Item : ItemField.Y_Item);
    }
  }

  private fixPoint(pointActive: Point3d, vp: Viewport, fromSnap: boolean): void {
    if (this.isActive() && ((vp !== this.currentView) || this.flags.rotationNeedsUpdate)) {
      this.currentView = vp;

      if (!(this.locked & LockedStates.ANGLE_BM || this.fieldLocked[ItemField.Z_Item])) {
        // origin not locked down...may change when vie changes...
        if (!this.flags.haveValidOrigin)
          this.setDefaultOrigin(vp);

        // in a view based rotation, and the view has changed, so update the rotation...
        if (!this.flags.lockedRotation) {
          this.updateRotation();
          this.flags.rotationNeedsUpdate = false;
        }
      }
    }
    if (this.isInactive() || this.isDeactivated()) {
      this.point.setFrom(pointActive);
      this.currentView = vp;

      if (this.published.flags)
        this.processHints();

      return;
    }
    if (this.isActive()) {
      this.rawPoint.setFrom(pointActive);
      this.currentView = vp;
      this.flags.dialogNeedsUpdate = true;

      if (TentativeOrAccuSnap.isHot() && CompassMode.Polar === this.getCompassMode())
        this.indexed = this.locked;
      else
        this.indexed = LockedStates.NONE_LOCKED;

      if (CompassMode.Polar === this.getCompassMode())
        this.fixPointPolar(vp);
      else
        this.fixPointRectangular(vp);

      pointActive.setFrom(this.point);
    } else if (CompassMode.Rectangular === this.getCompassMode()) {
      if (this.fieldLocked[ItemField.X_Item])
        pointActive.x = this.delta.x;

      if (this.fieldLocked[ItemField.Y_Item])
        pointActive.y = this.delta.y;

      if (this.fieldLocked[ItemField.Z_Item])
        pointActive.z = this.delta.z;
    }
  }

  private refreshDecorationsAndDynamics(): void {
    // Make sure AccuDraw updates it's decorations...
    const vp = this.currentView;
    if (!vp)
      return;

    vp.invalidateDecorations();

    // Make sure active tool updates it's dynamics. NOTE: Can't just call UpdateDynamics, need point adjusted for new locks, etc.
    const tool = toolAdmin.activeTool;
    if (!tool || !tool.isPrimitive())
      return;

    const ev = new BeButtonEvent();
    toolAdmin.fillEventFromCursorLocation(ev);

    // NOTE: Can't call DgnTool::OnMouseMotion since it can cause AccuDraw to move focus...
    const uorPoint = ev.point;
    toolAdmin.adjustPoint(uorPoint, ev.viewport!);
    ev.point = uorPoint;
    tool.updateDynamics(ev);
  }

  private onBeginDynamics(): boolean {
    if (!this.isEnabled())
      return false;

    this.onEventCommon();

    if (!this.isInactive())
      return false;

    const vp = this.currentView;
    if (!vp)
      return false;

    // NOTE: If ACS Plane lock setup initial and base rotation to ACS...
    if (vp && AccuDraw.useACSContextRotation(vp, false)) {
      this.setRotationMode(RotationMode.ACS);
      this.flags.baseRotation = RotationMode.ACS;
      this.flags.auxRotationPlane = RotationMode.Top;
    }

    if (this.published.flags & AccuDrawFlags.SmartRotation) {
      const hitDetail = TentativeOrAccuSnap.getCurrentSnap(false);

      // NEEDS_WORK
      //   if (!hitDetail)
      //     hitDetail = ElementLocateManager:: GetManager().GetCurrHit();

      //   if (hitDetail) {
      //     DPoint3d                origin;
      //     RotMatrix               rMatrix;
      //     RotateToElemToolHelper  rotateHelper;

      //     // NOTE: Surface normal stored in HitDetail is for hit point, not snap/adjusted point...get normal at correct location...
      //     if (rotateHelper.GetOrientation(* hitDetail, origin, rMatrix)) {
      //       this.setContextRotation(rMatrix);
      //       this.changeBaseRotationMode(RotationMode.Context);
      //     }
      //   }
    }

    this.checkRotation();

    // Compass will jump to correct location when fixPoint is called...but we don't want to see the jump...
    if (!this.flags.haveValidOrigin)
      this.setDefaultOrigin(vp);

    // Initialize rawPoint data...invalid for alignments until next fixPoint...
    this.rawPoint.setFrom(this.point);
    this.rawPointOnPlane.setFrom(this.point);

    // Upgrade state to enabled...want compass to display...
    this.currentState = CurrentState.Active;

    return false;
  }

  private onEndDynamics(): boolean {
    if (!this.isEnabled())
      return false;
    this.onEventCommon();
    if (!this.isActive())
      return false;
    // Downgrade state back to inactive...
    this.currentState = CurrentState.Inactive;
    return false;
  }

  private onPreDataButton(ev: BeButtonEvent): boolean {
    if (!this.isEnabled())
      return false;

    this.onEventCommon();
    this.flags.inDataPoint = true;
    if (this.currentState < CurrentState.Inactive)
      return false;
    if (!this.currentView)
      this.currentView = ev.viewport;
    this.updateRotation();
    return false;
  }

  private onPostDataButton(ev: BeButtonEvent): boolean {
    if (!this.isEnabled())
      return false;

    this.onEventCommon();

    if (this.flags.ignoreDataButton) {
      // NOTE: Ignore this data point, was used to terminate a viewing command or input collector...
      this.flags.ignoreDataButton = false;
    } else if (!this.flags.fixedOrg && this.currentState >= CurrentState.Inactive) {
      /* set origin to last point placed unless its being set elsewhere */
      if (((!this.getContextSensitive() &&
        !(this.published.flags & (AccuDrawFlags.AlwaysSetOrigin ^ AccuDrawFlags.SetOrigin))) ||
        !(this.published.flags & AccuDrawFlags.SetOrigin))) {
        this.published.flags |= AccuDrawFlags.SetOrigin;

        if (this.currentState >= CurrentState.Inactive)
          this.published.origin.setFrom(ev.point);
        else
          this.published.origin.setFrom(this.point);
      }

      this.saveLockedCoords();

      if (this.published.flags)
        this.processHints();

      if (this.currentState >= CurrentState.Inactive)
        this.updateRotation();
    }

    this.flags.inDataPoint = false;
    this.flags.indexLocked = false;
    return false;
  }

  private oResetButtonUp(ev: BeButtonEvent): boolean {
    if (tentativePoint.m_isActive && this.isActive()) {
      tentativePoint.clear(true);
      return true;
    }

    if (!this.isEnabled())
      return false;

    this.onEventCommon();
    return false;
  }

  private onTentative(): boolean {
    if (this.isActive() || this.isInactive())
      this.grabInputFocus(); // AccuDraw gets input focus on a tentative

    return false;
  }
}

const viewManager = ViewManager.instance;
const accuDraw = AccuDraw.instance;
const toolAdmin = ToolAdmin.instance;
const tentativePoint = TentativePoint.instance;
