/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { SavedState, AccuDraw, AccuDrawFlags, RotationMode, ContextMode, LockedStates, ThreeAxes, ItemField, KeyinStatus, CompassMode } from "../AccuDraw";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { TentativeOrAccuSnap } from "../AccuSnap";
import { BeButtonEvent, InputCollector, EventHandled } from "./Tool";
import { DecorateContext } from "../ViewContext";
import { LegacyMath } from "@bentley/imodeljs-common/lib/LegacyMath";
import { Vector3d, Point3d, RotMatrix, Geometry, Angle } from "@bentley/geometry-core";
import { Viewport } from "../Viewport";
import { AuxCoordSystemState } from "../AuxCoordSys";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { SnapDetail, SnapHeat } from "../HitDetail";
import { StandardViewId } from "../ViewState";
import { IModelApp } from "../IModelApp";

/**
 * A shortcut may require no user input  (immediate) or it may install a viewing tool.Tool implementors should not use
 * this class to setup AccuDraw, instead use AccuDraw.setContext to provide hints.
 */
export class AccuDrawShortcuts {
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
    if (LegacyMath.normalizedDifference(point, accudraw.planePt, xVec) < Geometry.smallAngleRadians)
      return false;

    accudraw.axes.x.setFrom(xVec);

    if (RotationMode.Context !== accudraw.rotationMode)
      accudraw.setRotationMode(RotationMode.Context);

    accudraw.flags.contextRotMode = ContextMode.XAxis;
    accudraw.flags.lockedRotation = false;

    accudraw.updateRotation();
    accudraw.refreshDecorationsAndDynamics();

    // Always want index line to display for x-Axis...changing rotation clears this...so it flashes...
    accudraw.indexed |= LockedStates.X_BM;
    return true;
  }

  public static updateACSByPoints(acs: AuxCoordSystemState, vp: Viewport, points: Point3d[], isDynamics: boolean): boolean {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return false;

    let accept = false;
    const vec = [new Vector3d(), new Vector3d(), new Vector3d()];
    acs.setOrigin(points[0]);
    switch (points.length) {
      case 1:
        acs.setRotation(vp.rotMatrix);
        if (!isDynamics) {
          accudraw.published.origin.setFrom(points[0]);
          accudraw.published.flags = AccuDrawFlags.SetOrigin;
          accudraw.flags.fixedOrg = true;
        }
        break;

      case 2:
        if (LegacyMath.normalizedDifference(points[1], points[0], vec[0]) < 0.00001) {
          accept = true;
          break;
        }

        if (vp.view.is3d()) {
          if (LegacyMath.normalizedCrossProduct(accudraw.axes.y, vec[0], vec[1]) < 0.00001) {
            vec[2].set(0.0, 0.0, 1.0);

            if (LegacyMath.normalizedCrossProduct(vec[2], vec[0], vec[1]) < 0.00001) {
              vec[2].set(0.0, 1.0, 0.0);
              LegacyMath.normalizedCrossProduct(vec[2], vec[0], vec[1]);
            }
          }

          LegacyMath.normalizedCrossProduct(vec[0], vec[1], vec[2]);
          acs.setRotation(RotMatrix.createRows(vec[0], vec[1], vec[2]));

          if (!isDynamics) {
            accudraw.published.origin.setFrom(points[0]);
            accudraw.published.flags = AccuDrawFlags.SetOrigin | AccuDrawFlags.SetNormal;
            accudraw.published.vector.setFrom(vec[0]);
          }
          break;
        }

        vec[2].set(0.0, 0.0, 1.0);
        LegacyMath.normalizedCrossProduct(vec[2], vec[0], vec[1]);
        acs.setRotation(RotMatrix.createRows(vec[0], vec[1], vec[2]));
        accept = true;
        break;

      case 3: {
        if (LegacyMath.normalizedDifference(points[1], points[0], vec[0]) < 0.00001 ||
          LegacyMath.normalizedDifference(points[2], points[0], vec[1]) < 0.00001 ||
          LegacyMath.normalizedCrossProduct(vec[0], vec[1], vec[2]) < 0.00001) {
          accept = true;
          break;
        }

        LegacyMath.normalizedCrossProduct(vec[2], vec[0], vec[1]);
        acs.setRotation(RotMatrix.createRows(vec[0], vec[1], vec[2]));
        accept = true;
        break;
      }
    }

    return accept;
  }

  public counterRotate(angle: number): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const rMatrix = accudraw.getRotation();
    rMatrix.multiplyVectorInPlace(accudraw.vector);
    const angleMatrix = RotMatrix.createRotationAroundVector(Vector3d.unitZ(), Angle.createRadians(-angle))!;
    rMatrix.multiplyMatrixMatrix(angleMatrix, rMatrix); // NEEDS_WORK - verify order
    accudraw.axes.fromRotMatrix(rMatrix);
    accudraw.flags.lockedRotation = true;
  }
  public static processPendingHints() { IModelApp.accuDraw.processHints(); }
  public static saveToolState(restore: boolean, ignoreFlags: AccuDrawFlags, stateBuffer?: SavedState) {
    const accudraw = IModelApp.accuDraw;

    if (restore) {
      if (!stateBuffer)
        stateBuffer = accudraw.savedState;

      if (0 !== (ignoreFlags & AccuDrawFlags.SetOrigin)) {
        stateBuffer.origin.setFrom(accudraw.origin);
      }

      if (0 !== (ignoreFlags & AccuDrawFlags.SetRMatrix)) {
        stateBuffer.axes.setFrom(accudraw.axes);

        stateBuffer.auxRotationPlane = accudraw.flags.auxRotationPlane;
        stateBuffer.contextRotMode = accudraw.flags.contextRotMode;
        stateBuffer.rotationMode = accudraw.rotationMode;
      }
    }

    if (stateBuffer && stateBuffer !== accudraw.savedState)
      accudraw.saveState(restore, stateBuffer);
  }

  public static synchSavedStateWithCurrent(stateBuffer?: SavedState): void {
    const accudraw = IModelApp.accuDraw;

    // Restore will leave current state active...used for shortcuts like RE that also enable AccuDraw...
    if (stateBuffer && stateBuffer !== accudraw.savedState)
      stateBuffer.state = accudraw.currentState;
    else
      accudraw.savedState.state = accudraw.currentState;
  }

  public static requestInputFocus() {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    accudraw.grabInputFocus();
    accudraw.refreshDecorationsAndDynamics();
  }

  //   //! Helper methods for GUI implementation...
  public static itemFieldNavigate(index: ItemField, str: string, forward: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.getFieldLock(index))
      accudraw.saveCoordinate(index, accudraw.getValueByIndex(index));

    if (!accudraw.isActive && KeyinStatus.Partial === accudraw.getKeyinStatus(index)) {
      accudraw.processFieldInput(index, str, true);
    } else {
      accudraw.setKeyinStatus(index, KeyinStatus.Dynamic);
      accudraw.onFieldValueChange(index);
    }

    const vp = accudraw.currentView;
    const is3d = vp ? vp.view.is3d() : false;
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

    accudraw.setKeyinStatus(index, KeyinStatus.Partial);
    accudraw.setFocusItem(index);
    accudraw.dontMoveFocus = true;
  }

  public static itemFieldNewInput(index: ItemField): void { IModelApp.accuDraw.setKeyinStatus(index, KeyinStatus.Partial); }
  public static itemFieldAcceptInput(index: ItemField, str: string): void {
    const accudraw = IModelApp.accuDraw;

    accudraw.processFieldInput(index, str, true);
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

  public static itemRotationModeChange(rotation: RotationMode): void {
    const accudraw = IModelApp.accuDraw;
    if (RotationMode.Context === rotation) {
      if (ContextMode.None !== accudraw.savedState.contextRotMode) {
        accudraw.setRotationMode(RotationMode.Restore);
        accudraw.updateRotation(true);
      } else {
        this.rotateAxes(true);
      }

      return;
    }

    const vp = accudraw.currentView;
    const is3d = vp ? vp.view.is3d() : true;

    if (!is3d && (RotationMode.Front === rotation || RotationMode.Side === rotation))
      accudraw.setRotationMode(RotationMode.Top);

    accudraw.flags.baseRotation = rotation;
    accudraw.updateRotation(true);
  }

  //   //! Shortcut implementations for GUI entry points...
  public setOrigin(explicitOrigin?: Point3d): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (explicitOrigin) {
      accudraw.published.origin.setFrom(explicitOrigin);
      accudraw.flags.haveValidOrigin = true;
    } else if (accudraw.isInactive || accudraw.isDeactivated) {
      // If AccuSnap is active use adjusted snap point, otherwise use last data point...
      if (IModelApp.accuSnap.isHot) {
        accudraw.published.origin.setFrom(TentativeOrAccuSnap.getCurrentPoint());
        accudraw.flags.haveValidOrigin = true;
      } else {
        const ev = new BeButtonEvent();
        IModelApp.toolAdmin.fillEventFromLastDataButton(ev);

        if (ev.viewport) {
          accudraw.published.origin.setFrom(ev.point);
          accudraw.flags.haveValidOrigin = true;
        } else {
          // NOTE: If current point isn't valid _SetDefaultOrigin will be called...
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
    accudraw.refreshDecorationsAndDynamics();
  }

  public changeCompassMode(): void {
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
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockSmart(): void {
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
      return;
    }

    if (accudraw.locked) { // if locked, unlock
      accudraw.clearTentative();
      accudraw.locked &= ~LockedStates.XY_BM;
      accudraw.setFieldLock(ItemField.X_Item, false);
      accudraw.setFieldLock(ItemField.Y_Item, false);

      if (accudraw.getFieldLock(ItemField.Z_Item) && accudraw.delta.z === 0.0 && !accudraw.stickyZLock)
        accudraw.setFieldLock(ItemField.Z_Item, false);
    } else if (!accudraw.indexed && accudraw.getFieldLock(ItemField.Z_Item) && !accudraw.stickyZLock) {
      accudraw.clearTentative();
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
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockX(): void {
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
    } else {
      accudraw.saveCoordinate(ItemField.X_Item, accudraw.delta.x);
      accudraw.setFieldLock(ItemField.X_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.X_BM;
    }
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockY(): void {
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
    } else {
      accudraw.saveCoordinate(ItemField.Y_Item, accudraw.delta.y);
      accudraw.setFieldLock(ItemField.Y_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.Y_BM;
    }
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockZ(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp || !vp.view.is3d())
      return;

    const isSnapped = accudraw.clearTentative();

    if (accudraw.getFieldLock(ItemField.Z_Item)) {
      accudraw.setFieldLock(ItemField.Z_Item, false);
    } else {
      // Move focus to Z field...
      if (!isSnapped && accudraw.autoFocusFields) {
        accudraw.setFocusItem(ItemField.Z_Item);
        accudraw.dontMoveFocus = true;
      }
      accudraw.setFieldLock(ItemField.Z_Item, true);
    }
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockDistance(): void {
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

      accudraw.setKeyinStatus(ItemField.DIST_Item, KeyinStatus.Dynamic); // Need to clear partial status if locked by entering distance since focus stays in distance field...
    } else {
      // Move focus to distance field...
      if (!isSnapped && accudraw.autoFocusFields)
        accudraw.setFocusItem(ItemField.DIST_Item);
      accudraw.distanceLock(true, true);
    }
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockAngle(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;
    accudraw.doLockAngle(accudraw.clearTentative());
    accudraw.refreshDecorationsAndDynamics();
  }

  public lockIndex(): void {
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

    accudraw.refreshDecorationsAndDynamics();
  }
  public static setStandardRotation(rotation: RotationMode, restoreContext: boolean = false): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.rotationMode === rotation && ContextMode.None !== accudraw.savedState.contextRotMode && restoreContext) {
      accudraw.setRotationMode(RotationMode.Restore);
    } else if (RotationMode.Context === rotation) {
      const axes = accudraw.baseAxes.clone();
      accudraw.accountForAuxRotationPlane(axes, accudraw.flags.auxRotationPlane);
      accudraw.setContextRotation(axes.toRotMatrix(), false, true);
      accudraw.refreshDecorationsAndDynamics();
      return;
    } else {
      accudraw.flags.baseRotation = rotation;
      accudraw.setRotationMode(rotation);
    }
    accudraw.updateRotation(true);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static alignView(): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp)
      return;

    const newMatrix = accudraw.getRotation();
    const oldMatrix = vp.rotMatrix.clone();

    if (newMatrix.isExactEqual(oldMatrix)) {
      // Compass currently aligned to view, rotate to saved axes if they are valid and different, otherwise use top or iso...
      if (!accudraw.savedState.axes.equals(accudraw.axes) &&
        0.0 !== accudraw.savedState.axes.x.magnitude() &&
        0.0 !== accudraw.savedState.axes.y.magnitude() &&
        0.0 !== accudraw.savedState.axes.z.magnitude())
        accudraw.savedState.axes.toRotMatrix(newMatrix);
      else
        AccuDraw.getStandardRotation(vp.view.is3d() ? StandardViewId.Iso : StandardViewId.Top, vp, false, newMatrix);

      if (newMatrix.isExactEqual(oldMatrix))
        return;
    }

    // Save old view rotation in saved axes so RV can toggle between old/new rotations...
    accudraw.savedState.axes.setFrom(ThreeAxes.createFromRotMatrix(oldMatrix));

    // NEEDS_WORK: Frustum morph doesn't keep fixed origin during transitional frames...
    //            Compare to behavior using mdlView_rotateToRMatrixAboutPoint which looked better...
    // Frustum startFrustum = vp -> GetFrustum();
    // Frustum frustum = startFrustum;

    // Transform   fromTrans, toTrans;

    // const origin = accudraw.origin;
    // fromTrans.InitFromMatrixAndFixedPoint(vp -> GetRotMatrix(), origin);
    // frustum.Multiply(fromTrans);
    // toTrans.InitFromMatrixAndFixedPoint(newMatrix, origin);
    // toTrans.InverseOf(toTrans);
    // frustum.Multiply(toTrans);

    // ViewportAnimatorPtr animator = ViewportAnimator:: Create(ViewportAnimator:: Params(* vp, true, BeDuration:: Seconds(1), 1), startFrustum, frustum);
    // animator -> SetTerminationHandler([](bool) { AccuDraw:: GetInstance().UpdateRotation(true); });
    // vp -> SetAnimator(* animator);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static rotateToBase(restoreContext: boolean): void { this.setStandardRotation(IModelApp.accuDraw.flags.baseRotation, restoreContext); }
  public static rotateToACS(restoreContext: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;
    // NOTE: Match current ACS orientation..reset auxRotationPlane to top!
    accudraw.flags.auxRotationPlane = RotationMode.Top;
    this.setStandardRotation(RotationMode.ACS, restoreContext);
  }

  public static rotateToPoint(ptIn: Point3d, animate: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const vp = accudraw.currentView;
    if (!vp)
      return;

    const point = ptIn.clone();
    if (!vp.view.is3d())
      point.z = 0.0;

    if (TentativeOrAccuSnap.isHot)
      accudraw.hardConstructionPlane(point, point, accudraw.planePt, accudraw.axes.z, vp, true);
    else
      accudraw.softConstructionPlane(point, point, accudraw.planePt, accudraw.axes.z, vp, true);

    // Snap point and compass origin coincide...
    const xVec = new Vector3d();
    if (LegacyMath.normalizedDifference(point, accudraw.planePt, xVec) < Geometry.smallAngleRadians)
      return;

    accudraw.axes.x.setFrom(xVec);
    if (RotationMode.Context !== accudraw.rotationMode)
      accudraw.setRotationMode(RotationMode.Context);
    accudraw.flags.contextRotMode = ContextMode.XAxis;
    accudraw.flags.lockedRotation = false;
    accudraw.updateRotation(animate);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static rotateCycle(updateCurrentACS: boolean): void {
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
        if (!updateCurrentACS) {
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
        }
        // copy it to an ACS
        accudraw.updateRotation();
        accudraw.flags.auxRotationPlane = RotationMode.Top;

      // AuxCoordSystemPtr acsPtr = AuxCoordSystem:: CreateFrom(vp -> GetViewController().GetAuxCoordinateSystem());
      // RotMatrix auxRMatrix;

      // accudraw.GetRotation(auxRMatrix);
      // acsPtr -> SetRotation(auxRMatrix);

      // AccuDraw:: UpdateAuxCoordinateSystem(* acsPtr, * vp);
      // then fall thru
      /* falls through */

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

    this.setStandardRotation(rotation, false);
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

    accudraw.setContextRotation(newRotation.toRotMatrix(), true, true);
    accudraw.refreshDecorationsAndDynamics();
  }

  public static rotateAxes(aboutCurrentZ: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (accudraw.clearTentative() || IModelApp.accuSnap.isHot ||
      (CompassMode.Polar === accudraw.compassMode && accudraw.getFieldLock(ItemField.ANGLE_Item)) ||
      (CompassMode.Polar !== accudraw.compassMode && accudraw.getFieldLock(ItemField.X_Item) && accudraw.getFieldLock(ItemField.Y_Item))) {
      if (AccuDrawShortcuts.rotateAxesByPoint(true, aboutCurrentZ)) {
        AccuDrawShortcuts.itemFieldUnlockAll();
        return;
      }
    }
    AccuDrawTool.installTool(new RotateAxesTool(aboutCurrentZ));
  }

  public static rotateToElement(updateCurrentACS: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (accudraw.isEnabled)
      AccuDrawTool.installTool(new RotateElementTool(updateCurrentACS, false));
  }

  public static defineACSByElement(): void {
    AccuDrawTool.installTool(new RotateElementTool(true, true));
  }

  public static defineACSByPoints() {
    const accudraw = IModelApp.accuDraw;
    if (accudraw.isEnabled)
      AccuDrawTool.installTool(new DefineACSByPointsTool());
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
      // Save current rotation, uStn event listener on ACS change will orient AccuDraw to ACS...
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
        const acs = currentACS.clone<AuxCoordSystemState>();

        const rMatrix = accudraw.getRotation();
        acs.setRotation(rMatrix);

        AccuDraw.updateAuxCoordinateSystem(acs, vp);
      }

      accudraw.published.flags &= ~AccuDrawFlags.OrientACS;
    }

    return BentleyStatus.SUCCESS;
  }

  public writeACS(_acsName: string): BentleyStatus {
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

class AccuDrawShortcutsTool extends InputCollector {
  public static toolId = "View.AccuDraw";
  private cancel: boolean;
  private shortcut: AccuDrawTool;

  public onPostInstall(): void { super.onPostInstall(); this.shortcut.doManipulationStart(); }
  public onCleanup(): void { this.shortcut.doManipulationStop(this.cancel); }
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> { if (this.shortcut.doManipulation(ev, false)) { this.cancel = false; this.exitTool(); } return EventHandled.No; }
  public async onMouseMotion(ev: BeButtonEvent) { this.shortcut.doManipulation(ev, true); }
  public decorate(context: DecorateContext) { this.shortcut.onDecorate(context); }
  public exitTool() { super.exitTool(); AccuDrawShortcuts.requestInputFocus(); } // re-grab focus when auto-focus tool setting set...
  public constructor(shortcut: AccuDrawTool) { super(); this.shortcut = shortcut; this.cancel = true; }
}

export abstract class AccuDrawTool {
  protected stateBuffer = new SavedState(); // Need separate state buffer since we aren't a ViewTool...

  public doManipulationStart() {
    AccuDrawShortcuts.saveToolState(false, 0, this.stateBuffer);
    const toolAdmin = IModelApp.toolAdmin;

    // NOTE: Unlike starting a viewing tool, an input collector inherits the suspended primitive's state and must set everything...
    toolAdmin.setLocateCursor(false);
    toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.None;

    if (this.activateAccuDrawOnStart())
      IModelApp.accuDraw.activate();

    const accuSnap = IModelApp.accuSnap;
    accuSnap.enableLocate(false);
    accuSnap.enableSnap(true);

    this.doManipulation(undefined, true);
  }

  public doManipulationStop(cancel: boolean) {
    if (!cancel)
      this.stateBuffer.ignoreDataButton = true; // Want to ignore data point event when terminating shortcut...
    AccuDrawShortcuts.saveToolState(true, cancel ? 0 : this.onManipulationComplete(), this.stateBuffer);
  }

  public activateAccuDrawOnStart() { return true; }
  public abstract doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean;
  public onManipulationComplete(): AccuDrawFlags { return 0; }
  public onDecorate(_context: DecorateContext) { }
  public static installTool(shortcut: AccuDrawTool): boolean { return new AccuDrawShortcutsTool(shortcut).run(); }
  public static outputPrompt(messageKey: string) { IModelApp.notifications.outputPromptByKey("AccuDraw.Prompt." + messageKey); }
}

class RotateAxesTool extends AccuDrawTool {
  constructor(private aboutCurrentZ: boolean) { super(); }
  public onManipulationComplete(): AccuDrawFlags { return AccuDrawFlags.SetRMatrix; }
  public doManipulationStart(): void {
    super.doManipulationStart();
    AccuDrawTool.outputPrompt("DefineXAxis");
  }
  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    const vp = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (!vp)
      return true;
    AccuDrawShortcuts.rotateAxesByPoint(TentativeOrAccuSnap.isHot, this.aboutCurrentZ);
    vp.invalidateDecorations();
    if (!isMotion)
      AccuDrawShortcuts.itemFieldUnlockAll();
    return true;
  }
}

class RotateElementTool extends AccuDrawTool {
  public moveOrigin = true;

  // RotateToElemToolHelper  rotateElmHelper;

  constructor(private updateCurrentACS: boolean, private updateDynamicACS: boolean) { super(); }
  public onManipulationComplete(): AccuDrawFlags { return AccuDrawFlags.SetOrigin | AccuDrawFlags.SetRMatrix; }

  public activateAccuDrawOnStart(): boolean {
    this.moveOrigin = !IModelApp.accuDraw.isActive; // Leave current origin is AccuDraw is already enabled...
    return !this.updateDynamicACS;
  }

  public doManipulationStart(): void {
    //   this.rotateElmHelper.enableGeometryCache(); // Keep geometry cache...
    super.doManipulationStart();
    AccuDrawTool.outputPrompt("DefineElem");
    const accuSnap = IModelApp.accuSnap;
    // If user doesn't want AccuSnap, tool will work fine with with just auto-locate (which the user can no longer disable).
    if (!accuSnap.isSnapEnabledByUser) {
      IModelApp.toolAdmin.setLocateCursor(true);
      accuSnap.enableLocate(true);
    }
  }

  public doManipulationStop(restore: boolean): void {
    super.doManipulationStop(restore);
    //  rotateElmHelper.ClearGeometryCache(); // Free cached geometry...
  }

  public updateOrientation(tmpSnapDetail: SnapDetail, ev: BeButtonEvent): boolean {
    const accudraw = IModelApp.accuDraw;
    if (accudraw.isActive && LockedStates.NONE_LOCKED !== accudraw.locked) {
      // Make sure adjusted point is used instead of close point on element...
      tmpSnapDetail.setSnapPoint(ev.point, SnapHeat.InRange);
      tmpSnapDetail.testPoint.setFrom(ev.point);
    } else {
      // Test point needs to reflect cursor position when tentative is active...
      tmpSnapDetail.testPoint.setFrom(ev.rawPoint);
    }

    // if (!rotateElmHelper.GetOrientation(tmpSnapDetail, origin, rMatrix))
    //   return false;

    // if (!moveOrigin)
    //   accudraw.GetOrigin(origin); // Don't want data to move origin...

    // accudraw.SetContext((AccuDrawFlags)(ACCUDRAW_AlwaysSetOrigin | ACCUDRAW_SetRMatrix), & origin, (DVec3dCP) & rMatrix);

    return true;
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    if (!ev || !ev.viewport)
      return true;

    const accuSnap = IModelApp.accuSnap;

    // NOTE: User could start tool with AccuSnap user enabled and then turn it off...detect this and enable auto-locate.
    //       If AccuSnap is enabled after the tool is started you can end up with both auto-locate and AccuSnap enabled,
    //       this is a little visually messy (locate cursor and AccuSnap)...but it doesn't cause major problems.
    if (!accuSnap.isActive)
      accuSnap.enableLocate(true);

    const snapDetail = TentativeOrAccuSnap.getCurrentSnap(false);
    if (snapDetail) {
      const tmpSnapDetail = snapDetail.clone();

      if (!this.updateOrientation(tmpSnapDetail, ev))
        return true;
    } else {
      const hitDetail = accuSnap.currHit;

      if (hitDetail) { // Don't early return if there isn't a current hit, ok to accept last hit...
        const tmpSnapDetail = new SnapDetail(hitDetail);

        if (!this.updateOrientation(tmpSnapDetail, ev))
          return true;
      }
    }

    if (this.updateDynamicACS)
      IModelApp.viewManager.invalidateDecorationsAllViews();

    if (isMotion)
      return true;

    const accudraw = IModelApp.accuDraw;
    if (this.updateCurrentACS) {

      AccuDrawShortcuts.processPendingHints();

      // const origin = accudraw.origin;
      // const rMatrix = accudraw.getRotation();
      // AuxCoordSystemPtr acsPtr = AuxCoordSystem:: CreateFrom(vp -> GetViewController().GetAuxCoordinateSystem());

      // acsPtr -> SetOrigin(origin);
      // acsPtr -> SetRotation(rMatrix);

      // AccuDraw:: UpdateAuxCoordinateSystem(* acsPtr, * vp);
    } else {
      accudraw.changeBaseRotationMode(RotationMode.Context); // Hold temporary rotation for tool duration when not updating ACS...
    }

    // RE enables Accudraw, so leave active regardless of state for suspended tool...
    AccuDrawShortcuts.synchSavedStateWithCurrent(this.stateBuffer);
    return true;
  }

  public onDecorate(context: DecorateContext): void {
    if (!this.updateDynamicACS)
      return;

    const accudraw = IModelApp.accuDraw;
    const origin = accudraw.origin;
    const rMatrix = accudraw.getRotation();
    const acs = context.viewport!.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();
    acs.setOrigin(origin);
    acs.setRotation(rMatrix);
    // acsPtr -> Display(context, ACSDisplayOptions:: Active | ACSDisplayOptions:: Dynamics);
  }
}

class DefineACSByPointsTool extends AccuDrawTool {
  private readonly points: Point3d[] = [];
  private acs?: AuxCoordSystemState;

  public onManipulationComplete(): AccuDrawFlags { return AccuDrawFlags.SetRMatrix; }

  public dDoManipulationStart(): void {
    super.doManipulationStart();

    const tentativePoint = IModelApp.tentativePoint;
    if (!tentativePoint.isActive) {
      AccuDrawTool.outputPrompt("DefineOrigin");
      return;
    }

    const origin = tentativePoint.getPoint().clone();
    AccuDrawTool.outputPrompt("DefineXAxis");
    IModelApp.accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin, origin);
    this.points.push(origin);
    tentativePoint.clear(true);
  }

  public doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): boolean {
    if (!ev || !ev.viewport)
      return true;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (isMotion)
      return false;

    this.points.push(ev.point.clone());

    const vp = ev.viewport;
    if (!this.acs)
      this.acs = vp.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();

    if (AccuDrawShortcuts.updateACSByPoints(this.acs, vp, this.points, false)) {
      AccuDraw.updateAuxCoordinateSystem(this.acs, vp);
      AccuDrawShortcuts.rotateToACS(false);
      return true;
    }

    AccuDrawTool.outputPrompt(1 === this.points.length ? "DefineXAxis" : "DefineYDir");
    return false;
  }

  public onDecorate(context: DecorateContext): void {
    const tmpPoints: Point3d[] = [];
    this.points.forEach((pt) => tmpPoints.push(pt));

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    tmpPoints.push(ev.point);

    const vp = context.viewport!;
    if (!this.acs)
      this.acs = vp.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();

    AccuDrawShortcuts.updateACSByPoints(this.acs, vp, tmpPoints, true);
    // this.acs -> Display(context, ACSDisplayOptions:: Active | ACSDisplayOptions:: Dynamics);
  }
}
