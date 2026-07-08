/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { AxisOrder, Geometry, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { AccuDraw, AccuDrawFlags, CompassMode, ContextMode, ItemField, KeyinStatus, LockedStates, RotationMode, ThreeAxes } from "../AccuDraw";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { ACSDisplayOptions, AuxCoordSystemState } from "../AuxCoordSys";
import { SnapDetail } from "../HitDetail";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { ScreenViewport, Viewport } from "../Viewport";
import { BeButtonEvent, CoreTools, Tool } from "./Tool";
import { AccuDrawShortcutImplementation, AccuDrawShortcutTool } from "./AccuDrawShortcutTool";
import { GraphicType } from "../common/render/GraphicType";

// cSpell:ignore dont unlockedz

function normalizedDifference(point1: Point3d, point2: Point3d, out: Vector3d): number {
  return point2.vectorTo(point1).normalizeWithLength(out).mag;
}

function normalizedCrossProduct(vec1: Vector3d, vec2: Vector3d, out: Vector3d): number {
  return vec1.crossProduct(vec2, out).normalizeWithLength(out).mag;
}

/**
 * A shortcut may require no user input (immediate) or it may install a tool to collect the needed input. AccuDrawShortcuts are how users control AccuDraw.
 * A tool implementor should not use this class to setup AccuDraw, instead use AccuDrawHintBuilder to provide hints.
 * @beta
 */
export class AccuDrawShortcuts {
  /** Disable/Enable AccuDraw for the session */
  public static sessionToggle(): void {
    const accudraw = IModelApp.accuDraw;

    if (accudraw.isEnabled)
      accudraw.disableForSession();
    else
      accudraw.enableForSession();
  }

  /** Suspend/Unsuspend AccuDraw for the active tool */
  public static suspendToggle(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.isActive)
      accudraw.deactivate();
    else
      accudraw.activate();

    accudraw.refreshDecorationsAndDynamics();
  }

  public static rotateAxesByPoint(isSnapped: boolean, aboutCurrentZ: boolean): boolean {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return false;

    const vp = accudraw.currentView;
    if (!vp)
      return false;

    const point = accudraw.point;
    if (!vp.view.is3d())
      point.z = 0.0;

    if (aboutCurrentZ)
      accudraw.hardConstructionPlane(point, point, accudraw.planePt, accudraw.axes.z, vp, isSnapped);
    else
      accudraw.softConstructionPlane(point, point, accudraw.planePt, accudraw.axes.z, vp, isSnapped);

    // Snap point and compass origin coincide...
    const xVec = new Vector3d();
    if (normalizedDifference(point, accudraw.planePt, xVec) < Geometry.smallAngleRadians)
      return false;

    accudraw.axes.x.setFrom(xVec);

    if (RotationMode.Context !== accudraw.rotationMode)
      accudraw.setRotationMode(RotationMode.Context);

    accudraw.flags.contextRotMode = ContextMode.XAxis;
    accudraw.flags.lockedRotation = false;

    accudraw.updateRotation();

    // Always want index line to display for x-Axis...changing rotation clears this...so it flashes...
    accudraw.indexed |= LockedStates.X_BM;
    return true;
  }

  public static updateACSByPoints(acs: AuxCoordSystemState, vp: Viewport, points: Point3d[], isDynamics: boolean): boolean {
    const accudraw = IModelApp.accuDraw;
    let accept = false;
    const vec = [new Vector3d(), new Vector3d(), new Vector3d()];
    acs.setOrigin(points[0]);
    switch (points.length) {
      case 1:
        acs.setRotation(vp.rotation);
        if (!isDynamics && accudraw.isEnabled) {
          accudraw.published.origin.setFrom(points[0]);
          accudraw.published.flags = AccuDrawFlags.SetOrigin;
          accudraw.flags.fixedOrg = true;
        }
        break;

      case 2:
        if (normalizedDifference(points[1], points[0], vec[0]) < 0.00001) {
          accept = true;
          break;
        }

        if (vp.view.is3d()) {
          if (accudraw.isEnabled && normalizedCrossProduct(accudraw.axes.y, vec[0], vec[1]) < 0.00001) {
            vec[2].set(0.0, 0.0, 1.0);

            if (normalizedCrossProduct(vec[2], vec[0], vec[1]) < 0.00001) {
              vec[2].set(0.0, 1.0, 0.0);
              normalizedCrossProduct(vec[2], vec[0], vec[1]);
            }
          }

          normalizedCrossProduct(vec[0], vec[1], vec[2]);
          acs.setRotation(Matrix3d.createRows(vec[0], vec[1], vec[2]));

          if (!isDynamics && accudraw.isEnabled) {
            accudraw.published.origin.setFrom(points[0]);
            accudraw.published.flags = AccuDrawFlags.SetOrigin | AccuDrawFlags.SetNormal;
            accudraw.published.vector.setFrom(vec[0]);
          }
          break;
        }

        vec[2].set(0.0, 0.0, 1.0);
        normalizedCrossProduct(vec[2], vec[0], vec[1]);
        acs.setRotation(Matrix3d.createRows(vec[0], vec[1], vec[2]));
        accept = true;
        break;

      case 3:
        if (normalizedDifference(points[1], points[0], vec[0]) < 0.00001 ||
          normalizedDifference(points[2], points[0], vec[1]) < 0.00001 ||
          normalizedCrossProduct(vec[0], vec[1], vec[2]) < 0.00001) {
          accept = true;
          break;
        }

        normalizedCrossProduct(vec[2], vec[0], vec[1]);
        acs.setRotation(Matrix3d.createRows(vec[0], vec[1], vec[2]));
        accept = true;
        break;
    }

    return accept;
  }

  public static processPendingHints() {
    IModelApp.accuDraw.processHints();
  }

  public static requestInputFocus() {
    IModelApp.accuDraw.requestInputFocus();
  }

  // Helper method for GUI implementation...
  public static async itemFieldNavigate(index: ItemField, str: string, forward: boolean): Promise<void> {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.getFieldLock(index))
      accudraw.saveCoordinate(index, accudraw.getValueByIndex(index));

    if (!accudraw.isActive && KeyinStatus.Partial === accudraw.getKeyinStatus(index)) {
      await accudraw.processFieldInput(index, str, true);
    } else {
      accudraw.setKeyinStatus(index, KeyinStatus.Dynamic);
      accudraw.onFieldValueChange(index);
    }

    const vp = accudraw.currentView;
    const is3d = vp ? accudraw.is3dCompass(vp) : false;
    const isPolar = (CompassMode.Polar === accudraw.compassMode);
    switch (index) {
      case ItemField.DIST_Item:
        index = ((is3d && !forward) ? ItemField.Z_Item : ItemField.ANGLE_Item);
        break;

      case ItemField.ANGLE_Item:
        index = ((is3d && forward) ? ItemField.Z_Item : ItemField.DIST_Item);
        break;

      case ItemField.X_Item:
        index = ((is3d && !forward) ? ItemField.Z_Item : ItemField.Y_Item);
        break;

      case ItemField.Y_Item:
        index = ((is3d && forward) ? ItemField.Z_Item : ItemField.X_Item);
        break;

      case ItemField.Z_Item:
        index = (forward ? (isPolar ? ItemField.DIST_Item : ItemField.X_Item) : (isPolar ? ItemField.ANGLE_Item : ItemField.Y_Item));
        break;
    }

    // Set focus to new item and disable automatic focus change based on cursor location in rectangular mode.
    accudraw.setFocusItem(index);
    accudraw.dontMoveFocus = true;
  }

  public static itemFieldNewInput(index: ItemField): void { IModelApp.accuDraw.setKeyinStatus(index, KeyinStatus.Partial); }
  public static itemFieldCompletedInput(index: ItemField): void { IModelApp.accuDraw.setKeyinStatus(index, KeyinStatus.Dynamic); }

  public static async itemFieldAcceptInput(index: ItemField, str: string): Promise<void> {
    const accudraw = IModelApp.accuDraw;
    await accudraw.processFieldInput(index, str, true);
    accudraw.setKeyinStatus(index, KeyinStatus.Dynamic);

    if (accudraw.getFieldLock(index))
      accudraw.saveCoordinate(index, accudraw.getValueByIndex(index));

    const vp = accudraw.currentView;
    if (accudraw.isActive) {
      if (!vp)
        return;

      if (CompassMode.Polar === accudraw.compassMode)
        accudraw.fixPointPolar(vp);
      else
        accudraw.fixPointRectangular(vp);

      accudraw.flags.dialogNeedsUpdate = true;
      return;
    }

    const is3d = vp ? vp.view.is3d() : false;
    const isPolar = (CompassMode.Polar === accudraw.compassMode);
    switch (index) {
      case ItemField.DIST_Item:
        index = ItemField.ANGLE_Item;
        break;

      case ItemField.ANGLE_Item:
        index = (is3d ? ItemField.Z_Item : ItemField.DIST_Item);
        break;

      case ItemField.X_Item:
        index = ItemField.Y_Item;
        break;

      case ItemField.Y_Item:
        index = (is3d ? ItemField.Z_Item : ItemField.X_Item);
        break;

      case ItemField.Z_Item:
        index = (isPolar ? ItemField.DIST_Item : ItemField.X_Item);
        break;
    }
    accudraw.setFocusItem(index);
  }

  public static itemFieldLockToggle(index: ItemField): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.getFieldLock(index)) {
      switch (index) {
        case ItemField.DIST_Item:
          accudraw.distanceLock(true, false);
          break;

        case ItemField.ANGLE_Item:
          accudraw.angleLock();
          break;

        case ItemField.X_Item:
          accudraw.clearTentative();
          accudraw.locked |= LockedStates.X_BM;
          break;

        case ItemField.Y_Item:
          accudraw.clearTentative();
          accudraw.locked |= LockedStates.Y_BM;
          break;

        case ItemField.Z_Item:
          accudraw.clearTentative();
          break;
      }

      return;
    }

    switch (index) {
      case ItemField.DIST_Item:
        accudraw.locked &= ~LockedStates.DIST_BM;
        break;

      case ItemField.ANGLE_Item:
        accudraw.locked &= ~LockedStates.ANGLE_BM;
        break;

      case ItemField.X_Item:
        accudraw.locked &= ~LockedStates.X_BM;
        break;

      case ItemField.Y_Item:
        accudraw.locked &= ~LockedStates.Y_BM;
        break;

      case ItemField.Z_Item:
        break;
    }

    accudraw.dontMoveFocus = false;
    accudraw.clearTentative();
  }

  public static choosePreviousValue(index: ItemField): void {
    const accudraw = IModelApp.accuDraw;
    accudraw.getSavedValue(index, false);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static chooseNextValue(index: ItemField): void {
    const accudraw = IModelApp.accuDraw;
    accudraw.getSavedValue(index, true);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static clearSavedValues(): void {
    const accudraw = IModelApp.accuDraw;
    accudraw.clearSavedValues();
  }

  public static itemRotationModeChange(rotation: RotationMode): void {
    const accudraw = IModelApp.accuDraw;
    const vp = accudraw.currentView;
    const is3d = vp ? vp.view.is3d() : true;

    if (!is3d && (RotationMode.Front === rotation || RotationMode.Side === rotation))
      accudraw.setRotationMode(RotationMode.Top);

    accudraw.flags.baseRotation = rotation;
    accudraw.updateRotation(true);
  }

  // Shortcut implementations for GUI entry points...
  public static setOrigin(explicitOrigin?: Point3d): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (explicitOrigin) {
      accudraw.published.origin.setFrom(explicitOrigin);
      accudraw.flags.haveValidOrigin = true;
    } else if (accudraw.isInactive || accudraw.isDeactivated) {
      // If AccuSnap is active use adjusted snap point, otherwise use last data point...
      const snap = TentativeOrAccuSnap.getCurrentSnap(false);
      if (undefined !== snap) {
        accudraw.published.origin.setFrom(snap.isPointAdjusted ? snap.adjustedPoint : snap.getPoint());
        accudraw.flags.haveValidOrigin = true;
      } else {
        const ev = new BeButtonEvent();
        IModelApp.toolAdmin.fillEventFromLastDataButton(ev);

        if (ev.viewport) {
          accudraw.published.origin.setFrom(ev.point);
          accudraw.flags.haveValidOrigin = true;
        } else {
          // NOTE: If current point isn't valid setDefaultOrigin will be called...
          accudraw.published.origin.setFrom(accudraw.point);
        }
      }
    } else {
      accudraw.published.origin.setFrom(accudraw.point);
      accudraw.flags.haveValidOrigin = true;
      accudraw.setLastPoint(accudraw.published.origin);
    }

    accudraw.clearTentative();
    const vp = accudraw.currentView;

    // NOTE: _AdjustPoint should have been called to have setup currentView...
    if (vp && !vp.view.is3d())
      accudraw.published.origin.z = 0.0;

    accudraw.origin.setFrom(accudraw.published.origin);
    accudraw.point.setFrom(accudraw.published.origin);
    accudraw.planePt.setFrom(accudraw.published.origin);
    accudraw.published.flags |= AccuDrawFlags.SetOrigin;
    accudraw.activate();
    accudraw.refreshDecorationsAndDynamics(); // NOTE: Will already grab input focus through processHints...
  }

  public static changeCompassMode(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    let axisLockStatus = accudraw.locked & LockedStates.XY_BM;

    if (axisLockStatus) {
      if (CompassMode.Rectangular === accudraw.compassMode) {
        if (axisLockStatus & LockedStates.X_BM && accudraw.delta.x !== 0.0)
          axisLockStatus &= ~LockedStates.X_BM;

        if (axisLockStatus & LockedStates.Y_BM && accudraw.delta.y !== 0.0)
          axisLockStatus &= ~LockedStates.Y_BM;
      }
    }

    accudraw.changeCompassMode(true);
    if (axisLockStatus) {
      if (CompassMode.Rectangular === accudraw.compassMode) {
        accudraw.delta.x = accudraw.delta.y = 0.0;

        if (axisLockStatus & LockedStates.X_BM)
          accudraw.setFieldLock(ItemField.X_Item, true);
        else if (axisLockStatus & LockedStates.Y_BM)
          accudraw.setFieldLock(ItemField.Y_Item, true);
      } else {
        accudraw.setFieldLock(ItemField.ANGLE_Item, true);
      }
      accudraw.locked = axisLockStatus;
    }
    accudraw.flags.baseMode = accudraw.compassMode;
    this.requestInputFocus();
  }

  public static lockSmart(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const accuSnap = IModelApp.accuSnap;

    // Don't want AccuSnap to influence axis or Z...
    if (accuSnap.isHot) {
      accuSnap.clear();

      const vp = accudraw.currentView;
      if (vp) {
        if (CompassMode.Polar === accudraw.compassMode)
          accudraw.fixPointPolar(vp);
        else
          accudraw.fixPointRectangular(vp);
      }
    }

    if (CompassMode.Polar === accudraw.compassMode) {
      const isSnapped = accudraw.clearTentative();
      if (accudraw.locked & LockedStates.ANGLE_BM) { // angle locked (unlock it)
        accudraw.setFieldLock(ItemField.ANGLE_Item, false);
        accudraw.locked &= ~LockedStates.ANGLE_BM;
      } else if (accudraw.getFieldLock(ItemField.DIST_Item)) { // distance locked (unlock it)
        accudraw.setFieldLock(ItemField.DIST_Item, false);
        accudraw.locked &= ~LockedStates.DIST_BM;
      } else if (isSnapped) {
        accudraw.doLockAngle(isSnapped);
      } else if (accudraw.indexed & LockedStates.ANGLE_BM) { // angle indexed (lock it)
        accudraw.angleLock();
      } else {
        if (Math.abs(accudraw.vector.dotProduct(accudraw.axes.x)) > Math.abs(accudraw.vector.dotProduct(accudraw.axes.y)))
          accudraw.indexed |= LockedStates.Y_BM;
        else
          accudraw.indexed |= LockedStates.X_BM;
        accudraw.angleLock();
      }
      this.requestInputFocus();
      return;
    }

    if (accudraw.locked) { // if locked, unlock
      accudraw.clearTentative();
      accudraw.locked &= ~LockedStates.XY_BM;
      accudraw.setFieldLock(ItemField.X_Item, false);
      accudraw.setFieldLock(ItemField.Y_Item, false);
      if (accudraw.getFieldLock(ItemField.Z_Item) && accudraw.delta.z === 0.0 && !accudraw.stickyZLock)
        accudraw.setFieldLock(ItemField.Z_Item, false);
    } else { // lock to nearest axis
      if (accudraw.clearTentative()) {
        if (Math.abs(accudraw.delta.x) >= Geometry.smallAngleRadians && Math.abs(accudraw.delta.y) >= Geometry.smallAngleRadians) {
          accudraw.doLockAngle(false);
          return;
        }
      }

      const vp = accudraw.currentView;
      if (Math.abs(accudraw.delta.x) > Math.abs(accudraw.delta.y)) {
        accudraw.delta.y = 0.0;
        accudraw.onFieldValueChange(ItemField.Y_Item);
        accudraw.locked |= LockedStates.Y_BM;
        accudraw.locked &= ~LockedStates.X_BM;
        accudraw.setFieldLock(ItemField.X_Item, false);
        accudraw.setFieldLock(ItemField.Y_Item, true);
        accudraw.setFieldLock(ItemField.Z_Item, vp ? vp.view.is3d() : false);
      } else {
        accudraw.delta.x = 0.0;
        accudraw.onFieldValueChange(ItemField.X_Item);
        accudraw.locked |= LockedStates.X_BM;
        accudraw.locked &= ~LockedStates.Y_BM;
        accudraw.setFieldLock(ItemField.Y_Item, false);
        accudraw.setFieldLock(ItemField.X_Item, true);
        accudraw.setFieldLock(ItemField.Z_Item, vp ? vp.view.is3d() : false);
      }

      if (!accudraw.flags.lockedRotation) {
        accudraw.flags.lockedRotation = true;
        accudraw.flags.contextRotMode = ContextMode.Locked;
        accudraw.setRotationMode(RotationMode.Context);
      }
    }
    this.requestInputFocus();
  }

  /** Disable indexing when not currently indexed; if indexed, enable respective lock. */
  public static lockIndex(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.flags.indexLocked) {
      if (accudraw.locked)
        this.lockSmart();

      accudraw.flags.indexLocked = false;
    } else {
      if (CompassMode.Polar === accudraw.compassMode) {
        if (accudraw.indexed & LockedStates.XY_BM) {
          accudraw.setFieldLock(ItemField.ANGLE_Item, true);
          accudraw.angleLock();
        }

        if (accudraw.indexed & LockedStates.DIST_BM)
          this.lockDistance();
      } else {
        if (accudraw.indexed & LockedStates.X_BM) {
          this.lockX();

          if (accudraw.indexed & LockedStates.DIST_BM)
            this.lockY();
        }

        if (accudraw.indexed & LockedStates.Y_BM) {
          this.lockY();

          if (accudraw.indexed & LockedStates.DIST_BM)
            this.lockX();
        }

        if (accudraw.indexed & LockedStates.DIST_BM && !(accudraw.indexed & LockedStates.XY_BM)) {
          if (accudraw.locked & LockedStates.X_BM)
            this.lockY();
          else
            this.lockX();
        }
      }

      accudraw.flags.indexLocked = true;
    }

    this.requestInputFocus();
  }

  public static lockX(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    accudraw.clearTentative();

    if (CompassMode.Rectangular !== accudraw.compassMode) {
      const vp = accudraw.currentView;
      if (!vp)
        return;

      accudraw.fixPointRectangular(vp);
      accudraw.changeCompassMode(true);
    }

    if (accudraw.getFieldLock(ItemField.X_Item)) {
      accudraw.setFieldLock(ItemField.X_Item, false);
      accudraw.locked = accudraw.locked & ~LockedStates.X_BM;
      accudraw.setKeyinStatus(ItemField.X_Item, KeyinStatus.Dynamic);
    } else {
      accudraw.saveCoordinate(ItemField.X_Item, accudraw.delta.x);
      accudraw.setFieldLock(ItemField.X_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.X_BM;
    }
    this.requestInputFocus();
  }

  public static lockY(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    accudraw.clearTentative();

    if (CompassMode.Rectangular !== accudraw.compassMode) {
      const vp = accudraw.currentView;
      if (!vp)
        return;

      accudraw.fixPointRectangular(vp);
      accudraw.changeCompassMode(true);
    }

    if (accudraw.getFieldLock(ItemField.Y_Item)) {
      accudraw.setFieldLock(ItemField.Y_Item, false);
      accudraw.locked = accudraw.locked & ~LockedStates.Y_BM;
      accudraw.setKeyinStatus(ItemField.Y_Item, KeyinStatus.Dynamic);
    } else {
      accudraw.saveCoordinate(ItemField.Y_Item, accudraw.delta.y);
      accudraw.setFieldLock(ItemField.Y_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.Y_BM;
    }
    this.requestInputFocus();
  }

  public static lockZ(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp || !vp.view.is3d())
      return;

    const isSnapped = accudraw.clearTentative();

    if (accudraw.getFieldLock(ItemField.Z_Item)) {
      accudraw.setFieldLock(ItemField.Z_Item, false);
      accudraw.setKeyinStatus(ItemField.Z_Item, KeyinStatus.Dynamic);
    } else {
      // Move focus to Z field...
      if (!isSnapped && accudraw.autoFocusFields) {
        accudraw.setFocusItem(ItemField.Z_Item);
        accudraw.dontMoveFocus = true;
      }
      accudraw.setFieldLock(ItemField.Z_Item, true);
    }
    this.requestInputFocus();
  }

  public static lockDistance(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const isSnapped = accudraw.clearTentative();

    if (CompassMode.Polar !== accudraw.compassMode) {
      const vp = accudraw.currentView;
      if (!vp)
        return;

      accudraw.locked = 0;
      accudraw.fixPointPolar(vp);
      accudraw.changeCompassMode(true);
    }

    if (accudraw.getFieldLock(ItemField.DIST_Item)) {
      accudraw.setFieldLock(ItemField.DIST_Item, false);
      accudraw.locked &= ~LockedStates.DIST_BM;
      accudraw.setKeyinStatus(ItemField.DIST_Item, KeyinStatus.Dynamic);
    } else {
      // Move focus to distance field...
      if (!isSnapped && accudraw.autoFocusFields)
        accudraw.setFocusItem(ItemField.DIST_Item);
      accudraw.distanceLock(true, true);
    }
    this.requestInputFocus();
  }

  public static lockAngle(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;
    accudraw.doLockAngle(accudraw.clearTentative());
    this.requestInputFocus();
  }

  public static setStandardRotation(rotation: RotationMode): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (RotationMode.Context === rotation) {
      const axes = accudraw.baseAxes.clone();
      accudraw.accountForAuxRotationPlane(axes, accudraw.flags.auxRotationPlane);
      accudraw.setContextRotation(axes.toMatrix3d(), false, true);
      this.requestInputFocus();
      return;
    } else {
      accudraw.flags.baseRotation = rotation;
      accudraw.setRotationMode(rotation);
    }
    accudraw.updateRotation(true);
    this.requestInputFocus();
  }

  public static alignView(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp)
      return;

    const newMatrix = accudraw.getRotation();
    if (newMatrix.isExactEqual(vp.rotation))
      return;

    const targetMatrix = newMatrix.multiplyMatrixMatrix(vp.rotation);
    const rotateTransform = Transform.createFixedPointAndMatrix(vp.view.getTargetPoint(), targetMatrix);
    const newFrustum = vp.getFrustum();
    newFrustum.multiply(rotateTransform);

    vp.view.setupFromFrustum(newFrustum);
    vp.synchWithView();
    vp.animateFrustumChange();

    this.requestInputFocus();
  }

  public static rotateToBase(): void { this.setStandardRotation(IModelApp.accuDraw.flags.baseRotation); }

  public static rotateToACS(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;
    // NOTE: Match current ACS orientation..reset auxRotationPlane to top!
    accudraw.flags.auxRotationPlane = RotationMode.Top;
    this.setStandardRotation(RotationMode.ACS);
  }

  public static rotateCycle(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp || !vp.view.is3d())
      return;

    let rotation: RotationMode;
    switch (accudraw.rotationMode) {
      case RotationMode.View:
      case RotationMode.Side:
        rotation = RotationMode.Top;
        break;

      case RotationMode.Top:
        rotation = RotationMode.Front;
        break;

      case RotationMode.Front:
        rotation = RotationMode.Side;
        break;

      case RotationMode.Context:
        rotation = RotationMode.Context;

        if (rotation !== accudraw.flags.baseRotation) {
          accudraw.baseAxes.setFrom(accudraw.axes);
          accudraw.flags.auxRotationPlane = RotationMode.Top;
          accudraw.flags.baseRotation = rotation;
        } else {
          const axes = accudraw.baseAxes.clone();
          accudraw.accountForAuxRotationPlane(axes, accudraw.flags.auxRotationPlane);
          if (!accudraw.axes.equals(axes))
            accudraw.changeBaseRotationMode(rotation);
        }

        switch (accudraw.flags.auxRotationPlane) {
          case RotationMode.Front:
            accudraw.flags.auxRotationPlane = RotationMode.Side;
            break;

          case RotationMode.Side:
            accudraw.flags.auxRotationPlane = RotationMode.Top;
            break;

          case RotationMode.Top:
            accudraw.flags.auxRotationPlane = RotationMode.Front;
            break;
        }
        break;

      case RotationMode.ACS:
        rotation = RotationMode.ACS;
        switch (accudraw.flags.auxRotationPlane) {
          case RotationMode.Front:
            accudraw.flags.auxRotationPlane = RotationMode.Side;
            break;
          case RotationMode.Side:
            accudraw.flags.auxRotationPlane = RotationMode.Top;
            break;
          case RotationMode.Top:
            accudraw.flags.auxRotationPlane = RotationMode.Front;
            break;
        }
        break;

      default:
        return;
    }

    this.setStandardRotation(rotation);
  }

  public static rotate90(axis: number): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const newRotation = new ThreeAxes();

    accudraw.locked = accudraw.indexed = 0;
    accudraw.unlockAllFields();

    switch (axis) {
      case 0:
        newRotation.x.setFrom(accudraw.axes.x);
        newRotation.z.setFrom(accudraw.axes.y);
        newRotation.z.crossProduct(newRotation.x, newRotation.y);
        break;

      case 1:
        newRotation.x.setFrom(accudraw.axes.z);
        newRotation.y.setFrom(accudraw.axes.y);
        newRotation.x.crossProduct(newRotation.y, newRotation.z);
        break;

      case 2:
        newRotation.x.setFrom(accudraw.axes.y);
        newRotation.z.setFrom(accudraw.axes.z);
        newRotation.z.crossProduct(newRotation.x, newRotation.y);
        break;
    }

    accudraw.setContextRotation(newRotation.toMatrix3d(), true, true);
    this.requestInputFocus();
  }

  public static async rotateAxes(aboutCurrentZ: boolean) {
    return IModelApp.tools.run("AccuDraw.RotateAxes", aboutCurrentZ);
  }

  public static async rotateToElement() {
    return IModelApp.tools.run("AccuDraw.RotateElement");
  }

  public static async defineACSByElement() {
    return IModelApp.tools.run("AccuDraw.DefineACSByElement");
  }

  public static async defineACSByPoints() {
    return IModelApp.tools.run("AccuDraw.DefineACSByPoints");
  }

  public static getACS(acsName: string | undefined, useOrigin: boolean, useRotation: boolean): BentleyStatus {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return BentleyStatus.ERROR;

    const vp = accudraw.currentView;
    if (!vp)
      return BentleyStatus.ERROR;

    let currRotation = 0, currBaseRotation = 0;
    const axes = new ThreeAxes();

    if (!useRotation) {
      // Save current rotation, event listener on ACS change will orient AccuDraw to ACS...
      currRotation = accudraw.rotationMode;
      currBaseRotation = accudraw.flags.baseRotation;
      axes.setFrom(accudraw.axes);
    }

    if (acsName && "" !== acsName) {
      //   // See if this ACS already exists...
      //   DgnCode acsCode = AuxCoordSystem:: CreateCode(vp -> GetViewControllerR().GetViewDefinition(), acsName);
      //   DgnElementId acsId = vp -> GetViewController().GetDgnDb().Elements().QueryElementIdByCode(acsCode);

      //   if (!acsId.IsValid())
      //     return ERROR;

      //   AuxCoordSystemCPtr auxElm = vp -> GetViewController().GetDgnDb().Elements().Get<AuxCoordSystem>(acsId);

      //   if (!auxElm.IsValid())
      //     return ERROR;

      //   AuxCoordSystemPtr acsPtr = auxElm -> MakeCopy<AuxCoordSystem>();

      //   if (!acsPtr.IsValid())
      //     return ERROR;

      //   AuxCoordSystemCR oldACS = vp -> GetViewController().GetAuxCoordinateSystem();

      //   if (!useOrigin)
      //     acsPtr -> SetOrigin(oldACS.GetOrigin());

      //   if (!useRotation)
      //     acsPtr -> SetRotation(oldACS.GetRotation());

      //   AccuDraw:: UpdateAuxCoordinateSystem(* acsPtr, * vp);
    }

    const currentACS = vp.view.auxiliaryCoordinateSystem;

    if (useOrigin) {
      accudraw.origin.setFrom(currentACS.getOrigin());
      accudraw.point.setFrom(accudraw.origin);
      accudraw.planePt.setFrom(accudraw.origin);
    }

    if (useRotation) {
      accudraw.flags.auxRotationPlane = RotationMode.Top;
      this.setStandardRotation(RotationMode.ACS);
    } else {
      this.itemFieldUnlockAll();

      accudraw.setRotationMode(currRotation);
      accudraw.flags.baseRotation = currBaseRotation;
      accudraw.axes.setFrom(axes);

      if (RotationMode.ACS === accudraw.flags.baseRotation) {
        const acs = currentACS.clone();

        const rMatrix = accudraw.getRotation();
        acs.setRotation(rMatrix);

        AccuDraw.updateAuxCoordinateSystem(acs, vp);
      }

      accudraw.published.flags &= ~AccuDrawFlags.OrientACS;
    }

    return BentleyStatus.SUCCESS;
  }

  public static writeACS(_acsName: string): BentleyStatus {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return BentleyStatus.ERROR;

    const vp = accudraw.currentView;
    if (!vp)
      return BentleyStatus.ERROR;

    // const origin = accudraw.origin;
    // const rMatrix = accudraw.getRotation();
    // AuxCoordSystemPtr acsPtr = AuxCoordSystem:: CreateFrom(vp -> GetViewController().GetAuxCoordinateSystem());
    // acsPtr -> SetOrigin(origin);
    // acsPtr -> SetRotation(rMatrix);
    // acsPtr -> SetType(CompassMode.Polar == accudraw.getCompassMode() ? ACSType :: Cylindrical : ACSType:: Rectangular);
    // acsPtr -> SetCode(AuxCoordSystem:: CreateCode(vp -> GetViewControllerR().GetViewDefinition(), nullptr != acsName ? acsName : ""));
    // acsPtr -> SetDescription("");

    // if (acsName && '\0' != acsName[0]) {
    //   DgnDbStatus status;
    //   acsPtr -> Insert(& status);

    //   if (DgnDbStatus:: Success != status)
    //   return BentleyStatus.ERROR;
    // }

    // AccuDraw:: UpdateAuxCoordinateSystem(* acsPtr, * vp);

    // accudraw.flags.baseRotation = RotationMode.ACS;
    // accudraw.SetRotationMode(RotationMode.ACS);

    return BentleyStatus.SUCCESS;
  }

  public static itemFieldUnlockAll(): void {
    const accudraw = IModelApp.accuDraw;
    if (accudraw.isEnabled)
      accudraw.unlockAllFields();
  }
}

/** @beta */
export class AccuDrawSessionToggleTool extends Tool {
  public static override toolId = "AccuDraw.SessionToggle";
  public override async run() {
    AccuDrawShortcuts.sessionToggle();
    return true;
  }
}

/** @beta */
export class AccuDrawSuspendToggleTool extends Tool {
  public static override toolId = "AccuDraw.SuspendToggle";
  public override async run() {
    AccuDrawShortcuts.suspendToggle();
    return true;
  }
}

/** @beta */
export class AccuDrawSetOriginTool extends Tool {
  public static override toolId = "AccuDraw.SetOrigin";
  public override async run() {
    AccuDrawShortcuts.setOrigin();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockSmartTool extends Tool {
  public static override toolId = "AccuDraw.LockSmart";
  public override async run() {
    AccuDrawShortcuts.lockSmart();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockIndexTool extends Tool {
  public static override toolId = "AccuDraw.LockIndex";
  public override async run() {
    AccuDrawShortcuts.lockIndex();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockXTool extends Tool {
  public static override toolId = "AccuDraw.LockX";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.lockX();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockYTool extends Tool {
  public static override toolId = "AccuDraw.LockY";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.lockY();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockZTool extends Tool {
  public static override toolId = "AccuDraw.LockZ";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.lockZ();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockDistanceTool extends Tool {
  public static override toolId = "AccuDraw.LockDistance";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.lockDistance();
    return true;
  }
}

/** @beta */
export class AccuDrawSetLockAngleTool extends Tool {
  public static override toolId = "AccuDraw.LockAngle";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.lockAngle();
    return true;
  }
}

/** @beta */
export class AccuDrawChangeModeTool extends Tool {
  public static override toolId = "AccuDraw.ChangeMode";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.changeCompassMode();
    return true;
  }
}

/** @beta */
export class AccuDrawRotateCycleTool extends Tool {
  public static override toolId = "AccuDraw.RotateCycle";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.rotateCycle();
    return true;
  }
}

/** @beta */
export class AccuDrawRotateTopTool extends Tool {
  public static override toolId = "AccuDraw.RotateTop";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.setStandardRotation(RotationMode.Top);
    return true;
  }
}

/** @beta */
export class AccuDrawRotateFrontTool extends Tool {
  public static override toolId = "AccuDraw.RotateFront";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.setStandardRotation(RotationMode.Front);
    return true;
  }
}

/** @beta */
export class AccuDrawRotateSideTool extends Tool {
  public static override toolId = "AccuDraw.RotateSide";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.setStandardRotation(RotationMode.Side);
    return true;
  }
}

/** @beta */
export class AccuDrawRotateViewTool extends Tool {
  public static override toolId = "AccuDraw.RotateView";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.setStandardRotation(RotationMode.View);
    return true;
  }
}

/** @beta */
export class AccuDrawRotate90AboutXTool extends Tool {
  public static override toolId = "AccuDraw.Rotate90AboutX";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.rotate90(0);
    return true;
  }
}

/** @beta */
export class AccuDrawRotate90AboutYTool extends Tool {
  public static override toolId = "AccuDraw.Rotate90AboutY";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.rotate90(1);
    return true;
  }
}

/** @beta */
export class AccuDrawRotate90AboutZTool extends Tool {
  public static override toolId = "AccuDraw.Rotate90AboutZ";
  public override async run(): Promise<boolean> {
    AccuDrawShortcuts.rotate90(2);
    return true;
  }
}

/** @internal */
class RotateAxesImplementation extends AccuDrawShortcutImplementation {
  public constructor(private readonly _aboutCurrentZ: boolean) { super(); }

  protected override get allowShortcut(): boolean { return IModelApp.accuDraw.isActive; } // Require compass to already be active for this shortcut...

  protected override get wantAdditionalInput(): boolean {
    if (TentativeOrAccuSnap.isHot)
      return false;

    const accudraw = IModelApp.accuDraw;

    if (CompassMode.Polar === accudraw.compassMode)
      return !accudraw.getFieldLock(ItemField.ANGLE_Item);

    return !(accudraw.getFieldLock(ItemField.X_Item) && accudraw.getFieldLock(ItemField.Y_Item));
  }

  protected override onProvideToolAssistance(): void {
    CoreTools.outputPromptByKey("AccuDraw.RotateAxes.Prompts.FirstPoint");
  }

  protected override onInitialize(): void {
    IModelApp.accuDraw.activate(); // State demoted to inactive by tool install...
    if (this._aboutCurrentZ)
      IModelApp.accuDraw.changeBaseRotationMode(RotationMode.Context); // Establish current orientation as base for when defining compass rotation by x axis...
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    const vp = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (!vp)
      return false;
    if (!AccuDrawShortcuts.rotateAxesByPoint(TentativeOrAccuSnap.isHot, this._aboutCurrentZ))
      return false;
    vp.invalidateDecorations();
    if (!isMotion) {
      AccuDrawShortcuts.itemFieldUnlockAll();
      IModelApp.tentativePoint.clear(true);
    }
    return true;
  }
}

/** @beta */
export class AccuDrawRotateAxesTool extends AccuDrawShortcutTool {
  public static override toolId = "AccuDraw.RotateAxes";
  public static override get maxArgs(): number { return 1; }
  public constructor(public aboutCurrentZ: boolean = true) { super(); }

  /** @internal */
  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new RotateAxesImplementation(this.aboutCurrentZ);
  }

  public override async parseAndRun(...args: any[]): Promise<boolean> {
    for (const arg of args) {
      if (arg.toLowerCase() === "unlockedz")
        this.aboutCurrentZ = false;
    }
    return this.run();
  }
}

/** @internal */
class RotateElementImplementation extends AccuDrawShortcutImplementation {
  private _moveOrigin = !IModelApp.accuDraw.isActive || IModelApp.tentativePoint.isActive; // Preserve current origin if AccuDraw already active and not tentative snap...

  protected override get allowShortcut(): boolean { return IModelApp.accuDraw.isEnabled; } // Require AccuDraw to be enabled by the application for this shortcut...
  protected override get wantAdditionalInput(): boolean { return !IModelApp.tentativePoint.isSnapped; }

  protected override onProvideToolAssistance(): void {
    CoreTools.outputPromptByKey("AccuDraw.RotateElement.Prompts.FirstPoint");
  }

  protected override onInitialize(): void {
    IModelApp.accuDraw.activate();
    IModelApp.accuDraw.setContext(AccuDrawFlags.FixedOrigin); // Don't move compass when updateOrientation returns false...
  }

  protected override onComplete(): AccuDrawFlags {
    let ignoreFlags = AccuDrawFlags.SetRMatrix | AccuDrawFlags.Disable; // If AccuDraw wasn't active when the shortcut started, let it remain active for suspended tool when shortcut completes...
    if (this._moveOrigin)
      ignoreFlags |= AccuDrawFlags.SetOrigin;
    return ignoreFlags;
  }

  private updateOrientation(snap: SnapDetail, viewport: ScreenViewport): boolean {
    const accudraw = IModelApp.accuDraw;
    const rMatrix = AccuDraw.getSnapRotation(snap, viewport);
    if (undefined === rMatrix)
      return false;

    const point = this._moveOrigin ? snap.snapPoint : accudraw.origin;
    accudraw.setContext(AccuDrawFlags.SetRMatrix | AccuDrawFlags.AlwaysSetOrigin, point, rMatrix);
    return true;
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    const viewport = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (!viewport)
      return false;

    const snap = TentativeOrAccuSnap.getCurrentSnap(false);
    if (undefined === snap || !this.updateOrientation(snap, viewport))
      return false;

    if (undefined === ev)
      AccuDrawShortcuts.processPendingHints(); // Would normally be processed after button down, necessary when called from post install...

    const vp = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (vp)
      vp.invalidateDecorations();

    if (!isMotion)
      IModelApp.accuDraw.changeBaseRotationMode(RotationMode.Context); // Hold temporary rotation for tool duration...
    return true;
  }
}

/** @beta */
export class AccuDrawRotateElementTool extends AccuDrawShortcutTool {
  public static override toolId = "AccuDraw.RotateElement";

  /** @internal */
  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new RotateElementImplementation();
  }
}

/** @internal */
class RotatePointsImplementation extends AccuDrawShortcutImplementation {
  private readonly _points: Point3d[] = [];
  private _origin = IModelApp.tentativePoint.isActive ? IModelApp.tentativePoint.getPoint().clone() : undefined;
  private _moveOrigin = !IModelApp.accuDraw.isActive || IModelApp.tentativePoint.isActive; // Preserve current origin if AccuDraw already active and not tentative snap...
  private _lastPoint?: Point3d;

  protected override onProvideToolAssistance(): void {
    switch (this._points.length) {
      case 0:
        CoreTools.outputPromptByKey("AccuDraw.RotatePoints.Prompts.FirstPoint");
        break;

      case 1:
        CoreTools.outputPromptByKey("AccuDraw.RotatePoints.Prompts.SecondPoint");
        break;

      default:
        CoreTools.outputPromptByKey("AccuDraw.RotatePoints.Prompts.NextPoint");
        break;
    }
  }

  protected override onInitialize(): void {
    if (undefined === this._origin)
      return;

    this._points.push(this._origin);
    IModelApp.tentativePoint.clear(true); // Necessary when installed as an InputCollector...

    IModelApp.accuDraw.activate();
    IModelApp.accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin, this._origin);
    IModelApp.accuDraw.refreshDecorationsAndDynamics();
  }

  protected override onComplete(): AccuDrawFlags {
    let ignoreFlags = AccuDrawFlags.SetRMatrix | AccuDrawFlags.Disable; // If AccuDraw wasn't active when the shortcut started, let it remain active for suspended tool when shortcut completes...
    if (this._moveOrigin)
      ignoreFlags |= AccuDrawFlags.SetOrigin;
    return ignoreFlags;
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    if (!ev || !ev.viewport)
      return false;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (isMotion) {
      this._lastPoint = ev.point.clone();
      return false;
    }

    const accuDraw = IModelApp.accuDraw;
    accuDraw.activate();

    switch (this._points.length) {
      case 0: {
        this._points.push(ev.point.clone());
        accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin, this._points[0]);
        break;
      }

      case 1: {
        const xVec = Vector3d.createNormalizedStartEnd(this._points[0], ev.point);
        if (undefined === xVec)
          return false;

        if (!ev.viewport.view.is3d() || !ev.viewport.view.allow3dManipulations()) {
          accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.SetXAxis, this._points[0], xVec);
          return true; // Complete
        }

        this._points.push(ev.point.clone());
        accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin | AccuDrawFlags.SetNormal, this._points[0], xVec);
        break;
      }

      case 2: {
        const xVec = Vector3d.createNormalizedStartEnd(this._points[0], this._points[1]);
        if (undefined === xVec)
          return false;

        const yVec = Vector3d.createNormalizedStartEnd(this._points[0], ev.point);
        if (undefined === yVec)
          return false;

        const matrix = Matrix3d.createRigidFromColumns(xVec, yVec, AxisOrder.XYZ);
        if (undefined === matrix)
          return false;

        const invMatrix = matrix.inverse();
        if (undefined === invMatrix)
          return false;

        accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.SetRMatrix, this._points[0], invMatrix);
        return true; // Complete
      }
    }

    this.onProvideToolAssistance();
    return false;
  }

  public override doDecorate(context: DecorateContext): void {
    if (0 === this._points.length)
      return;

    const currentPoint = this._lastPoint;
    if (undefined === currentPoint)
      return;

    if (2 === this._points.length) { // && CoordSource.User !== ev.coordsFrom) {
      const xVec = Vector3d.createNormalizedStartEnd(this._points[0], this._points[1]);
      if (undefined === xVec)
        return;

      const plane = Plane3dByOriginAndUnitNormal.create(this._points[0], xVec);
      if (undefined === plane)
        return;

      plane.projectPointToPlane(currentPoint, currentPoint);
    }

    const tmpPoints = this._points.slice(0, 1);
    tmpPoints.push(currentPoint);

    const vp = context.viewport;
    const color = vp.getContrastToBackgroundColor();
    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);

    builder.setSymbology(color, color, 2);
    builder.addLineString(tmpPoints);

    context.addDecorationFromBuilder(builder);
  }
}

/** @beta */
export class AccuDrawRotatePointsTool extends AccuDrawShortcutTool {
  public static override toolId = "AccuDraw.RotatePoints";

  /** @internal */
  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new RotatePointsImplementation();
  }
}

/** @internal */
class DefineACSByElementImplementation extends AccuDrawShortcutImplementation {
  private _origin = Point3d.create();
  private _rMatrix = Matrix3d.createIdentity();
  private _acs?: AuxCoordSystemState;

  protected override onProvideToolAssistance(): void {
    CoreTools.outputPromptByKey("AccuDraw.DefineACSByElement.Prompts.FirstPoint");
  }

  private updateOrientation(snap: SnapDetail, vp: Viewport): boolean {
    const rMatrix = AccuDraw.getSnapRotation(snap, vp);
    if (undefined === rMatrix)
      return false;
    this._origin = snap.snapPoint;
    this._rMatrix = rMatrix;
    return true;
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    const vp = ev ? ev.viewport : undefined;
    if (!vp)
      return false;

    const snapDetail = TentativeOrAccuSnap.getCurrentSnap(false);
    if (undefined === snapDetail || !this.updateOrientation(snapDetail, vp))
      return false;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (isMotion)
      return true;

    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone();

    this._acs.setOrigin(this._origin);
    this._acs.setRotation(this._rMatrix);
    AccuDraw.updateAuxCoordinateSystem(this._acs, vp);
    AccuDrawShortcuts.rotateToACS();
    return true;
  }

  public override doDecorate(context: DecorateContext): void {
    const vp = context.viewport;
    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone();
    this._acs.setOrigin(this._origin);
    this._acs.setRotation(this._rMatrix);
    this._acs.display(context, ACSDisplayOptions.Active | ACSDisplayOptions.Dynamics);
  }
}

/** @beta */
export class DefineACSByElementTool extends AccuDrawShortcutTool {
  public static override toolId = "AccuDraw.DefineACSByElement";

  /** @internal */
  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new DefineACSByElementImplementation();
  }
}

/** @internal */
class DefineACSByPointsImplementation extends AccuDrawShortcutImplementation {
  private readonly _points: Point3d[] = [];
  private _acs?: AuxCoordSystemState;
  private _origin = IModelApp.tentativePoint.isActive ? IModelApp.tentativePoint.getPoint().clone() : undefined;
  private _lastPoint?: Point3d;

  protected override onProvideToolAssistance(): void {
    switch (this._points.length) {
      case 0:
        CoreTools.outputPromptByKey("AccuDraw.DefineACSByPoints.Prompts.FirstPoint");
        break;

      case 1:
        CoreTools.outputPromptByKey("AccuDraw.DefineACSByPoints.Prompts.SecondPoint");
        break;

      default:
        CoreTools.outputPromptByKey("AccuDraw.DefineACSByPoints.Prompts.NextPoint");
        break;
    }
  }

  protected override onInitialize(): void {
    if (undefined === this._origin)
      return;

    this._points.push(this._origin);
    IModelApp.tentativePoint.clear(true); // Necessary when installed as an InputCollector...

    IModelApp.accuDraw.activate();
    IModelApp.accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin, this._origin);
    IModelApp.accuDraw.refreshDecorationsAndDynamics();
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    if (!ev || !ev.viewport)
      return false;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (isMotion) {
      this._lastPoint = ev.point.clone();
      return false;
    }

    IModelApp.accuDraw.activate();
    this._points.push(ev.point.clone());

    const vp = ev.viewport;
    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone();

    if (AccuDrawShortcuts.updateACSByPoints(this._acs, vp, this._points, false)) {
      AccuDraw.updateAuxCoordinateSystem(this._acs, vp);
      AccuDrawShortcuts.rotateToACS();
      return true;
    }

    this.onProvideToolAssistance();
    return false;
  }

  public override doDecorate(context: DecorateContext): void {
    if (undefined === this._lastPoint)
      return;

    const tmpPoints: Point3d[] = [];
    this._points.forEach((pt) => tmpPoints.push(pt));
    tmpPoints.push(this._lastPoint);

    const vp = context.viewport;
    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone();

    AccuDrawShortcuts.updateACSByPoints(this._acs, vp, tmpPoints, true);
    this._acs.display(context, ACSDisplayOptions.Active | ACSDisplayOptions.Dynamics);
  }
}

/** @beta */
export class DefineACSByPointsTool extends AccuDrawShortcutTool {
  public static override toolId = "AccuDraw.DefineACSByPoints";

  /** @internal */
  protected override createImplementation(): AccuDrawShortcutImplementation {
    return new DefineACSByPointsImplementation();
  }
}
