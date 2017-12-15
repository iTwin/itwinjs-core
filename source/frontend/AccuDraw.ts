/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d, RotMatrix, Point2d } from "@bentley/geometry-core/lib/PointVector";
import { Viewport } from "./Viewport";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { StandardViewId, standardViewMatrices } from "../common/ViewState";
import { ViewManager } from "./ViewManager";
import { ToolAdmin } from "./tools/ToolAdmin";
import { ColorDef, ColorRgb } from "../common/Render";
import { BeButtonEvent, CoordSource, BeModifierKey } from "./tools/Tool";

// tslint:disable:no-empty
const enum AccuDrawFlags {
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

const enum CompassMode {
  Polar = 0,
  Rectangular = 1,
}

const enum RotationMode {
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

const enum ItemField {
  DIST_Item = 0,
  ANGLE_Item = 1,
  X_Item = 2,
  Y_Item = 3,
  Z_Item = 4,
}

enum KeyinStatus {
  Dynamic = 0,
  Partial = 1,
  DontUpdate = 2,
}

enum Constants {
  MAX_SAVED_VALUES = 20,
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

/**
 * Accudraw is an aide for entering coordinate data
 */
class AccuDraw {
  public static readonly instance = new AccuDraw();
  private currentState: CurrentState;     // Compass state
  private currentMode: CompassMode;      // Compass mode
  private rotationMode: RotationMode;     // Compass rotation
  private currentView: Viewport;      // will be nullptr if view not yet defined
  private published: AccudrawData;        // Staging area for hints
  private readonly origin = new Point3d();           // origin point...not on compass plane when z != 0.0
  private readonly axes = [new Vector3d(), new Vector3d(), new Vector3d()];          // X, Y and Z vecs (3d rotation matrix)
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
  private readonly baseAxes: Vector3d[] = [];      // Used for "context" base rotation to hold arbitrary rotation w/o needing to change ACS...
  private readonly lastAxes: Vector3d[] = [];      // Last result from UpdateRotation, replaces cM.rMatrix...
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

  private getCompassViewport(): Viewport | undefined { return this.currentView; }
  private getRotation(rMatrix?: RotMatrix): RotMatrix { RotMatrix.createRows(this.axes[0], this.axes[1], this.axes[2], rMatrix); return rMatrix; }

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

  // public clearTentative(): boolean {
  //   if (!TentativePoint:: GetInstance().IsActive())
  //   return false;

  //   bool   wasSnapped = TentativePoint:: GetInstance().IsSnapped();

  //   TentativePoint:: GetInstance().Clear(true);

  //   return wasSnapped;
  // }

  public doAutoPoint(index: ItemField, mode: CompassMode): void {
    const vp = this.getCompassViewport();
    if (!vp)
      return;

    if (CompassMode.Polar === mode) {
      if (!this.autoPointPlacement)
        return;

      if (this.fieldLocked[ItemField.DIST_Item] && (this.fieldLocked[ItemField.ANGLE_Item] || this.indexed & LockedStates.ANGLE_BM) && KeyinStatus.Dynamic === this.getKeyinStatus(index)) {
        this.fixPointPolar(vp);
        this.sendDataPoint(this.point, vp);
      }

      return;
    }

    if (this.fieldLocked[ItemField.X_Item] && this.fieldLocked[ItemField.Y_Item]) {
      if (!this.isActive()) {
        if (!vp.view.is3d() || this.fieldLocked[ItemField.Z_Item]) {
          DPoint3d point;
          DPoint3d globalOrigin = DPoint3d:: FromZero();

          if (vp.view.isSpatialView())
            vp.view.iModel.globalOrigin;

          bsiDVec3d_add((DVec3dP) & point, & m_delta, (DVec3dCP) & globalOrigin);
          this.sendDataPoint(point, * vp);
        }

        return;
      }

      if (!_GetAutoPointPlacement() || KeyinStatus.Dynamic != this.getKeyinStatus(index))
        return;

      m_point.SumOf(m_origin, m_axes[0], m_delta.x);
      m_point.SumOf(m_point, m_axes[1], m_delta.y);
      m_point.SumOf(m_point, m_axes[2], m_delta.z);

      this.sendDataPoint(m_point, * vp);

      return;
    }

    if (!_GetAutoPointPlacement() || KEYIN_Dynamic != GetKeyinStatus(index))
      return;

    if ((X_Item == index && this.fieldLocked[ItemField.X_Item]) && (this.indexed & Y_BM)) || (ItemField.Y_Item == index && this.fieldLocked[ItemField.Y_Item]) && (this.indexed & X_BM))) {
      m_point.SumOf(m_origin, m_axes[0], m_delta.x);
      m_point.SumOf(m_point, m_axes[1], m_delta.y);
      m_point.SumOf(m_point, m_axes[2], m_delta.z);

      this.sendDataPoint(m_point, * vp);
    }
  }

  private getStandardRotation(nStandard: StandardViewId, vp?: Viewport, useACS: boolean): RotMatrix | undefined {
    if (nStandard < StandardViewId.Top || nStandard > StandardViewId.RightIso)
      return undefined;

    const rMatrix = standardViewMatrices[nStandard].clone();
    if (!useACS)
      return rMatrix;

    const useVp = vp ? vp : viewManager.selectedView;
    if (!useVp)
      return undefined;

    // NEEDS_WORK_ACS rMatrix.multiplyMatrixMatrix(useVp.view.getAuxiliaryCoordinateSystemId().GetRotation(), rMatrix);
    return rMatrix;
  }

  private static getCurrentOrientation(vp: Viewport, checkAccuDraw: boolean, checkACS: boolean, rMatrix?: RotMatrix): RotMatrix | undefined {
    if (checkAccuDraw && accudraw.isActive())
      return accudraw.getRotation(rMatrix);

    const useVp = vp ? vp : viewManager.selectedView;
    if (!useVp)
      return RotMatrix.createIdentity(rMatrix);

    // NEEDS_WORK_ACS
    // if (checkACS && useVp.isContextRotationRequired())
    //   return useVp.view.getAuxCoordinateSystem().getRotation();

    return useVp.rotMatrix;
  }

  //   /*---------------------------------------------------------------------------------**//**
  //   * @bsimethod                                                    BrienBastings   07/07
  //   +---------------+---------------+---------------+---------------+---------------+------*/
  //   bool AccuDraw:: GetHitDetailRotation(RotMatrixR rMatrix, HitDetailCR hit) {
  //     DPoint3d                origin;
  //     RotateToElemToolHelper  rotateHelper;

  //     return rotateHelper.GetOrientation(hit, origin, rMatrix);
  //   }

  // /*---------------------------------------------------------------------------------**//**
  // * @bsimethod                                                    BrienBastings   03/17
  // +---------------+---------------+---------------+---------------+---------------+------*/
  // void AccuDraw:: UpdateAuxCoordinateSystem(AuxCoordSystemCR acs, DgnViewportR vp, bool allViews)
  // {
  //   // When modeling with multiple spatial views open, you'd typically want the same ACS in all views...
  //   if (allViews && vp.GetViewController().IsSpatialView()) {
  //     for (auto & otherVp : ViewManager:: GetManager().GetViewports())
  //     {
  //       if (otherVp.get() == & vp || !otherVp -> GetViewController().IsSpatialView())
  //         continue;

  //       otherVp -> GetViewControllerR().SetAuxCoordinateSystem(acs);
  //     }
  //   }

  //   vp.GetViewControllerR().SetAuxCoordinateSystem(acs);

  //   // NOTE: Change AccuDraw's base rotation to ACS, MicroStation does this in MstnACSEventListener::_OnACSEvent...
  //   AccuDraw:: GetInstance().SetContext(ACCUDRAW_OrientACS);
  // }

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

      if (this.getFieldLock(ItemField.ANGLE_Item))
        this.saveCoordinate(ItemField.ANGLE_Item, this.angle);
    } else {
      if (this.getFieldLock(ItemField.X_Item))
        this.saveCoordinate(ItemField.X_Item, this.delta.x);

      if (this.getFieldLock(ItemField.Y_Item))
        this.saveCoordinate(ItemField.Y_Item, this.delta.y);
    }

    const vp = this.getCompassViewport();

    if (vp && vp.view.Is3d()) {
      if (this.getFieldLock(ItemField.Z_Item))
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
      if (value > 1.0e-12 && this.savedCoords.savedValIsAngle[this.savedCoords.nSaveValues] === isAngle && value !== currValue)
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
        this.updateVector(m_angle);
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

  // virtual double _GetIndexToleranceInches() { return 0.11; }
  // DGNVIEW_EXPORT virtual void _SetDefaultOrigin(DgnViewportP vp);

  // // Event Notification/Handling...unless otherwise noted implementors expected to return false...
  // DGNVIEW_EXPORT virtual bool _OnPrimitiveToolInstall();
  // DGNVIEW_EXPORT virtual bool _OnViewToolInstall();
  // DGNVIEW_EXPORT virtual bool _OnViewToolExit();
  // DGNVIEW_EXPORT virtual bool _OnBeginDynamics();
  // DGNVIEW_EXPORT virtual bool _OnEndDynamics();
  // DGNVIEW_EXPORT virtual bool _OnPreDataButton(DgnButtonEventCR); //! Called before sending data button down event to active tool.
  // DGNVIEW_EXPORT virtual bool _OnPostDataButton(DgnButtonEventCR); //! Called after data button down event has been sent to tool.
  // DGNVIEW_EXPORT virtual bool _OnResetButtonUp(DgnButtonEventCR); //! Returns true if reset was used to clear a tentative (reset not to be processed/consumed).
  // DGNVIEW_EXPORT virtual bool _OnSnap(SnapContextR context);
  // DGNVIEW_EXPORT virtual bool _OnTentative();
  // DGNVIEW_EXPORT virtual void _OnSelectedViewportChanged(DgnViewportP previous, DgnViewportP current);
  // DGNVIEW_EXPORT virtual bool _OnKeyTransition(bool wentDown, VirtualKey key, bool shiftIsDown, bool ctrlIsDown) { return false; }

  // virtual bool _OnMotion(DgnButtonEventCR) { return false; }
  // virtual bool _OnNoMotion(DgnButtonEventCR) { return false; }

  // DGNVIEW_EXPORT virtual bool _AdjustPoint(DPoint3dR pointActive, DgnViewportR vp, bool fromSnap);
  // DGNVIEW_EXPORT virtual void _ProcessHints();
  // DGNVIEW_EXPORT virtual void _DisplayAlignments(Render:: GraphicBuilderR graphic, DgnViewportR vp);
  // DGNVIEW_EXPORT virtual void _Display(DecorateContextR);

  // public:

  // DGNVIEW_EXPORT AccuDraw();
  // virtual ~AccuDraw(){ }

  // DGNVIEW_EXPORT bool IsEnabled() const ;     //! Accudraw is enabled for use in this session.
  // bool IsInactive() const ;                   //! Waiting for data point/dynamics to automatically activate.
  // bool IsDeactivated() const ;                //! Won't become active automatically, may allow user to do so manually.

  // DGNVIEW_EXPORT void EnableForSession();    //! Session can use AccuDraw...TOOLS SHOULD NOT CALL THIS!!!
  // DGNVIEW_EXPORT void DisableForSession();   //! Session can't use AccuDraw...TOOLS SHOULD NOT CALL THIS!!!

  // DGNVIEW_EXPORT BentleyStatus StringToAngle(double & angle, bool * isBearing, Utf8CP string, bool restrict) const ;
  // DGNVIEW_EXPORT void StringFromAngle(Utf8StringR, double angle, bool allNegative) const ;

  // DGNVIEW_EXPORT BentleyStatus StringToUORs(double & uors, Utf8CP string) const ;
  // DGNVIEW_EXPORT void StringFromUORs(Utf8StringR string, double uors) const ;

  // DGNVIEW_EXPORT void SetCompassMode(CompassMode mode);
  // DGNVIEW_EXPORT void SetRotationMode(RotationMode mode);

  // DGNVIEW_EXPORT bool GetFieldLock(ItemField index) const ;
  // DGNVIEW_EXPORT void SetFieldLock(ItemField index, bool locked);

  // DGNVIEW_EXPORT BentleyStatus UpdateFieldValue(ItemField index, double value, bool synchText, bool saveInHistory);
  // DGNVIEW_EXPORT void UpdateFieldLock(ItemField index, bool locked);
  // DGNVIEW_EXPORT void ProcessFieldInput(ItemField index, Utf8CP string, bool synchText);

  // DGNVIEW_EXPORT bool IsNegativeX() const ;
  // DGNVIEW_EXPORT bool IsNegativeY() const ;
  // DGNVIEW_EXPORT bool IsExplicitX() const ;
  // DGNVIEW_EXPORT bool IsExplicitY() const ;

  // DGNVIEW_EXPORT bool GetDialogNeedsUpdate() const ;
  // DGNVIEW_EXPORT bool GetSoftAngleLock() const ;
  // DGNVIEW_EXPORT bool GetIndexLocked() const ;

  // DGNVIEW_EXPORT KeyinStatus GetKeyinStatus(ItemField index) const ;
  // DGNVIEW_EXPORT void SetKeyinStatus(ItemField index, KeyinStatus status);

  // DGNVIEW_EXPORT ItemField GetNewFocus() const ;
  // DGNVIEW_EXPORT void SetNewFocus(ItemField index);

  // DGNVIEW_EXPORT bool GetDontMoveFocus() const ;
  // DGNVIEW_EXPORT void SetDontMoveFocus(bool value);

  // DGNVIEW_EXPORT void ChooseNextValue(ItemField index);

  // DGNVIEW_EXPORT void ChangeBaseMode(CompassMode mode);
  // DGNVIEW_EXPORT void ChangeBaseRotationMode(RotationMode mode);
  // DGNVIEW_EXPORT void ChangeRotationMode(RotationMode mode);
  // DGNVIEW_EXPORT void SetContextRotation(RotMatrixCR rMatrix, bool locked = true, bool animate = false);

  // DGNVIEW_EXPORT void GetDistanceRoundOff(RoundOff &) const ;
  // DGNVIEW_EXPORT void SetDistanceRoundOff(RoundOff const&);
  // DGNVIEW_EXPORT void GetAngleRoundOff(RoundOff &) const ;
  // DGNVIEW_EXPORT void SetAngleRoundOff(RoundOff const&);

  // DGNVIEW_EXPORT bool IsActive() const ;  //! Compass is active/displayed.
  // DGNVIEW_EXPORT void Activate();        //! For tools to explicitly enable AccuDraw before dynamics start.
  // DGNVIEW_EXPORT void Deactivate();      //! For tools that don't support AccuDraw or don't want it automatically enabled.

  // DGNVIEW_EXPORT DgnViewportP GetCompassViewport() const ;         //! Current compass viewport
  // DGNVIEW_EXPORT void GetRotation(RotMatrixR rMatrix) const ;      //! Current compass orientation
  // DGNVIEW_EXPORT void GetBaseRotation(RotMatrixR rMatrix) const ;  //! Current compass base orientation
  // DGNVIEW_EXPORT void GetOrigin(DPoint3dR origin) const ;          //! Current compass origin
  // DGNVIEW_EXPORT void GetDelta(DVec3dR delta) const ;              //! Current compass xyz delta
  // DGNVIEW_EXPORT double GetDistance() const ;                      //! Current compass polar distance
  // DGNVIEW_EXPORT double GetAngle() const ;                         //! Current compass polar angle
  // DGNVIEW_EXPORT LockedStates GetLocked() const ;                  //! Current compass locks bitmask
  // DGNVIEW_EXPORT bool GetFloatingOrigin() const ;                  //! Current compass floating origin setting
  // DGNVIEW_EXPORT CompassMode GetCompassMode() const ;              //! Current compass mode
  // DGNVIEW_EXPORT RotationMode GetRotationMode() const ;            //! Current compass rotation type
  // DGNVIEW_EXPORT RotationMode GetBaseRotationMode() const ;        //! Current compass base rotation type

  // //! Allow tools to clear locks/floating origin state, etc. from a prior call to SetContext (i.e. what happens when starting a new tool).
  // DGNVIEW_EXPORT void ClearContext();

  // //! Allow tools to provide hints to Accudraw for setting compass location, orientation, mode, etc.
  // //! @see AccuDrawHintBuilder
  // DGNVIEW_EXPORT BentleyStatus SetContext(AccuDrawFlags flags, DPoint3dCP origin = NULL, DVec3dCP orientation = NULL, DVec3dCP delta = NULL, double const* distance=NULL, double const* angle=NULL, TransformCP trans = NULL);

  // DGNVIEW_EXPORT static bool GetStandardRotation(RotMatrixR rMatrix, StandardView nStandard, DgnViewportP viewport, bool useACS);
  // DGNVIEW_EXPORT static bool GetCurrentOrientation(RotMatrixR rMatrix, DgnViewportP viewport, bool checkAccuDraw, bool checkACS);
  // DGNVIEW_EXPORT static bool GetHitDetailRotation(RotMatrixR rMatrix, HitDetailCR hit);
  // DGNVIEW_EXPORT static void UpdateAuxCoordinateSystem(AuxCoordSystemCR, DgnViewportR, bool allViews = true);

  // DGNVIEW_EXPORT static AccuDrawR GetInstance(); //! Get the current AccuDraw instance.

  // DGNVIEW_EXPORT bool OnKeyTransition(bool wentDown, VirtualKey key, bool shiftIsDown, bool ctrlIsDown) { return _OnKeyTransition(wentDown, key, shiftIsDown, ctrlIsDown); }

  // }; // AccuDraw

  // struct AccuDrawHintBuilder;
  // typedef RefCountedPtr < AccuDrawHintBuilder > AccuDrawHintBuilderPtr;

  // /*=================================================================================**//**
  // * AccuDrawHintBuilder is a DgnTool helper class that facilitates AccuDraw interaction.
  // * The tool does not directly change the current AccuDraw state; the tool's job is merely
  // * to supply "hints" to AccuDraw regarding it's preferred AccuDraw configuration for the 
  // * current tool state. User settings such as "Context Sensitivity" and "Floating Origin"
  // * affect how/which hints get applied.
  // * @bsiclass
  // +===============+===============+===============+===============+===============+======*/
  // struct AccuDrawHintBuilder: RefCountedBase
  // {
  //   private:
  //   bool        m_setOrigin: 1;
  //   bool        m_setOriginFixed: 1;
  //   bool        m_setOriginAlways: 1;
  //   bool        m_setRotation: 1;
  //   bool        m_setXAxis: 1;
  //   bool        m_setXAxis2: 1;
  //   bool        m_setNormal: 1;
  //   bool        m_setDistance: 1;
  //   bool        m_setAngle: 1;
  //   bool        m_setModePolar: 1;
  //   bool        m_setModeRectangular: 1;
  //   bool        m_setLockDistance: 1;
  //   bool        m_setLockAngle: 1;
  //   bool        m_setLockX: 1;
  //   bool        m_setLockY: 1;
  //   bool        m_setLockZ: 1;
  //   bool        m_enableSmartRotation: 1;

  //   DPoint3d    m_origin;
  //   DVec3d      m_axis;
  //   RotMatrix   m_rMatrix;
  //   double      m_distance;
  //   double      m_angle;

  //   public:
  //   AccuDrawHintBuilder();

  //   //! Create an instance of an AccuDrawHintBuilder for the purpose of tool interaction with AccuDraw.
  //   //! @return A reference counted pointer to an AccuDrawHintBuilder.
  //   DGNVIEW_EXPORT static AccuDrawHintBuilderPtr Create();

  //   DGNVIEW_EXPORT void SetOrigin(DPoint3dCR); //! Specify location for the compass origin.
  //   DGNVIEW_EXPORT void SetRotation(RotMatrixCR); //! Fully specify compass orientation. Tools should take care to not make AccuDraw's Z perpendicular to the view's Z.
  //   DGNVIEW_EXPORT void SetXAxis(DVec3dCR); //! Specify compass X axis direction taking the current AccuDraw rotation into account in computing Y and Z axes.
  //   DGNVIEW_EXPORT void SetXAxis2(DVec3dCR); //! Specify compass X axis direction taking the current AccuDraw rotation and view direction into account in computing Y and Z axes.
  //   DGNVIEW_EXPORT void SetNormal(DVec3dCR); //! Specify compass Z axis direction taking the current AccuDraw rotation into account in computing X and Y axes.
  //   DGNVIEW_EXPORT void SetModePolar(); //! Change compass to polar mode.
  //   DGNVIEW_EXPORT void SetModeRectangular(); //! Change compass to rectangular mode.
  //   DGNVIEW_EXPORT void SetDistance(double); //! Specify polar mode distance (in uors).
  //   DGNVIEW_EXPORT void SetAngle(double); //! Specify polar mode angle (in radians).
  //   DGNVIEW_EXPORT void SetOriginFixed(); //! Specify that compass remain at a fixed location for the current tool and not follow subsequent data points.
  //   DGNVIEW_EXPORT void SetOriginAlways(); //! Specify that "Floating Origin" setting not be honored which would normally cause the SetOrigin hint to be ignored.
  //   DGNVIEW_EXPORT void SetLockDistance(); //! Specify that polar mode distance is locked. Locks are cleared on next data button or by user interaction.
  //   DGNVIEW_EXPORT void SetLockAngle(); //! Specify that polar mode angle is locked. Locks are cleared on next data button or by user interaction.
  //   DGNVIEW_EXPORT void SetLockX(); //! Specify that rectangular mode X delta is locked. Locks are cleared on next data button or by user interaction.
  //   DGNVIEW_EXPORT void SetLockY(); //! Specify that rectangular mode Y delta is locked. Locks are cleared on next data button or by user interaction.
  //   DGNVIEW_EXPORT void SetLockZ(); //! Specify that rectangular mode Z delta is locked. Locks are cleared on next data button or by user interaction.
  //   DGNVIEW_EXPORT void EnableSmartRotation(); //! Call before AccuDraw is enabled (either explicitly or automatically) to choose an orientation from the current hit.

  //   DGNVIEW_EXPORT BentleyStatus SendHints(bool activate = true); //! Calls AccuDraw::SetContext using the current builder state.
  // };

  // //__PUBLISH_SECTION_END__
  // /*=================================================================================**//**
  // * Class that implements AccUDraw shortcuts. A shortcut may require no user input
  // * (immediate) or it may install a viewing tool. Tool implementors should not use
  // * this class to setup AccuDraw, instead use AccuDraw::SetContext to provide hints.
  // * @bsiclass
  // +===============+===============+===============+===============+===============+======*/
  // struct AccuDrawShortcuts
  // {
  // static bool RotateAxesByPoint(bool isSnapped, bool aboutCurrentZ);
  // static bool UpdateACSByPoints(AuxCoordSystemR, DgnViewportR vp, bvector<DPoint3d>& points, bool isDynamics);
  // static void CounterRotate(double angle);
  // static void ProcessPendingHints();
  // static void SaveToolState(bool restore, AccuDrawFlags ignoreFlags, AccuDraw:: SavedState * stateBuffer);
  // static void SynchSavedStateWithCurrent(AccuDraw:: SavedState * stateBuffer);
  // static void RequestInputFocus();

  //   //! Helper methods for GUI implementation...
  //   DGNVIEW_EXPORT static void ItemFieldNavigate(AccuDraw:: ItemField item, Utf8CP string, bool forward);
  //   DGNVIEW_EXPORT static void ItemFieldNewInput(AccuDraw:: ItemField item);
  //   DGNVIEW_EXPORT static void ItemFieldAcceptInput(AccuDraw:: ItemField item, Utf8CP string);
  //   DGNVIEW_EXPORT static void ItemFieldLockToggle(AccuDraw:: ItemField item); // Lock state changed from GUI...
  //   DGNVIEW_EXPORT static void ItemFieldUnlockAll();
  //   DGNVIEW_EXPORT static void ItemRotationModeChange(AccuDraw:: RotationMode rotation);

  //   //! Shortcut implementations for GUI entry points...
  //   DGNVIEW_EXPORT static void SetOrigin(DPoint3dCP origin);
  //   DGNVIEW_EXPORT static void ChangeCompassMode();
  //   DGNVIEW_EXPORT static void LockSmart();
  //   DGNVIEW_EXPORT static void LockX();
  //   DGNVIEW_EXPORT static void LockY();
  //   DGNVIEW_EXPORT static void LockZ();
  //   DGNVIEW_EXPORT static void LockDistance();
  //   DGNVIEW_EXPORT static void LockAngle();
  //   DGNVIEW_EXPORT static void LockIndex();
  //   DGNVIEW_EXPORT static void SetStandardRotation(AccuDraw:: RotationMode rotation, bool restoreContext = false);
  //   DGNVIEW_EXPORT static void AlignView();
  //   DGNVIEW_EXPORT static void RotateToBase(bool restoreContext = false);
  //   DGNVIEW_EXPORT static void RotateToACS(bool restoreContext = false);
  //   DGNVIEW_EXPORT static void RotateToPoint(DPoint3d point, bool animate);
  //   DGNVIEW_EXPORT static void RotateCycle(bool updateCurrentACS = false);
  //   DGNVIEW_EXPORT static void Rotate90(int axis);
  //   DGNVIEW_EXPORT static void RotateAxes(bool aboutCurrentZ = true);
  //   DGNVIEW_EXPORT static void RotateToElement(bool updateCurrentACS = false); // NOTE: Uses tentative (if active) for fixed origin...
  //   DGNVIEW_EXPORT static void DefineACSByElement(); // Similar to RotateToElement with updateCurrentACS true but doesn't enable AccuDraw...
  //   DGNVIEW_EXPORT static void DefineACSByPoints(); // NOTE: Uses tentative (if active) for origin and only prompts for x and y...

  //   DGNVIEW_EXPORT static BentleyStatus GetACS(Utf8CP acsName, bool useOrigin, bool useRotation);
  //   DGNVIEW_EXPORT static BentleyStatus WriteACS(Utf8CP acsName);

  // }; // AccuDrawShortcuts

  // //__PUBLISH_SECTION_START__

  // END_BENTLEY_DGN_NAMESPACE

  // /** @endcond */
}

const viewManager = ViewManager.instance;
const accudraw = AccuDraw.instance;
const toolAdmin = ToolAdmin.instance;
