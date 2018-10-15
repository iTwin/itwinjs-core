/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import { AccuDraw, AccuDrawFlags, RotationMode, ContextMode, LockedStates, ThreeAxes, ItemField, KeyinStatus, CompassMode } from "../AccuDraw";
import { CoordinateLockOverrides } from "./ToolAdmin";
import { TentativeOrAccuSnap, AccuSnap } from "../AccuSnap";
import { BeButtonEvent, InputCollector, EventHandled } from "./Tool";
import { DecorateContext } from "../ViewContext";
import { Vector3d, Point3d, Matrix3d, Geometry, Transform } from "@bentley/geometry-core";
import { Viewport } from "../Viewport";
import { AuxCoordSystemState, ACSDisplayOptions } from "../AuxCoordSys";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { SnapDetail, SnapMode } from "../HitDetail";
import { IModelApp } from "../IModelApp";

function normalizedDifference(point1: Point3d, point2: Point3d, out: Vector3d): number { return point2.vectorTo(point1).normalizeWithLength(out).mag; }
function normalizedCrossProduct(vec1: Vector3d, vec2: Vector3d, out: Vector3d): number { return vec1.crossProduct(vec2, out).normalizeWithLength(out).mag; }
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
    if (!accudraw.isEnabled)
      return false;

    let accept = false;
    const vec = [new Vector3d(), new Vector3d(), new Vector3d()];
    acs.setOrigin(points[0]);
    switch (points.length) {
      case 1:
        acs.setRotation(vp.rotation);
        if (!isDynamics) {
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
          if (normalizedCrossProduct(accudraw.axes.y, vec[0], vec[1]) < 0.00001) {
            vec[2].set(0.0, 0.0, 1.0);

            if (normalizedCrossProduct(vec[2], vec[0], vec[1]) < 0.00001) {
              vec[2].set(0.0, 1.0, 0.0);
              normalizedCrossProduct(vec[2], vec[0], vec[1]);
            }
          }

          normalizedCrossProduct(vec[0], vec[1], vec[2]);
          acs.setRotation(Matrix3d.createRows(vec[0], vec[1], vec[2]));

          if (!isDynamics) {
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

  public static processPendingHints() { IModelApp.accuDraw.processHints(); }

  public static requestInputFocus() {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    accudraw.grabInputFocus();
    accudraw.refreshDecorationsAndDynamics();
  }

  // Helper method for GUI implementation...
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
    accudraw.refreshDecorationsAndDynamics();
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
    accudraw.refreshDecorationsAndDynamics();
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
      accudraw.refreshDecorationsAndDynamics();
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
    } else {
      accudraw.saveCoordinate(ItemField.X_Item, accudraw.delta.x);
      accudraw.setFieldLock(ItemField.X_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.X_BM;
    }
    accudraw.refreshDecorationsAndDynamics();
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
    } else {
      accudraw.saveCoordinate(ItemField.Y_Item, accudraw.delta.y);
      accudraw.setFieldLock(ItemField.Y_Item, true);
      accudraw.locked = accudraw.locked | LockedStates.Y_BM;
    }
    accudraw.refreshDecorationsAndDynamics();
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

      accudraw.setKeyinStatus(ItemField.DIST_Item, KeyinStatus.Dynamic); // Need to clear partial status if locked by entering distance since focus stays in distance field...
    } else {
      // Move focus to distance field...
      if (!isSnapped && accudraw.autoFocusFields)
        accudraw.setFocusItem(ItemField.DIST_Item);
      accudraw.distanceLock(true, true);
    }
    accudraw.refreshDecorationsAndDynamics();
  }

  public static lockAngle(): void {
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
        AccuDrawShortcuts.lockSmart();

      accudraw.flags.indexLocked = false;
    } else {
      if (CompassMode.Polar === accudraw.compassMode) {
        if (accudraw.indexed & LockedStates.XY_BM) {
          accudraw.setFieldLock(ItemField.ANGLE_Item, true);
          accudraw.angleLock();
        }

        if (accudraw.indexed & LockedStates.DIST_BM)
          AccuDrawShortcuts.lockDistance();
      } else {
        if (accudraw.indexed & LockedStates.X_BM) {
          AccuDrawShortcuts.lockX();

          if (accudraw.indexed & LockedStates.DIST_BM)
            AccuDrawShortcuts.lockY();
        }

        if (accudraw.indexed & LockedStates.Y_BM) {
          AccuDrawShortcuts.lockY();

          if (accudraw.indexed & LockedStates.DIST_BM)
            AccuDrawShortcuts.lockX();
        }

        if (accudraw.indexed & LockedStates.DIST_BM && !(accudraw.indexed & LockedStates.XY_BM)) {
          if (accudraw.locked & LockedStates.X_BM)
            AccuDrawShortcuts.lockY();
          else
            AccuDrawShortcuts.lockX();
        }
      }

      accudraw.flags.indexLocked = true;
    }

    accudraw.refreshDecorationsAndDynamics();
  }

  public static setStandardRotation(rotation: RotationMode): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    if (RotationMode.Context === rotation) {
      const axes = accudraw.baseAxes.clone();
      accudraw.accountForAuxRotationPlane(axes, accudraw.flags.auxRotationPlane);
      accudraw.setContextRotation(axes.toMatrix3d(), false, true);
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
    if (newMatrix.isExactEqual(vp.rotation))
      return;

    const targetMatrix = newMatrix.multiplyMatrixMatrix(vp.rotation);
    const rotateTransform = Transform.createFixedPointAndMatrix(vp.view.getTargetPoint(), targetMatrix);
    const startFrustum = vp.getFrustum();
    const newFrustum = startFrustum.clone();
    newFrustum.multiply(rotateTransform);

    vp.animateFrustumChange(startFrustum, newFrustum);
    vp.view.setupFromFrustum(newFrustum);
    vp.synchWithView(true);

    accudraw.refreshDecorationsAndDynamics();
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

        const currentACS = vp.view.auxiliaryCoordinateSystem;
        const acs = currentACS.clone<AuxCoordSystemState>();

        acs.setRotation(accudraw.getRotation());
        AccuDraw.updateAuxCoordinateSystem(acs, vp);

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
    accudraw.refreshDecorationsAndDynamics();
  }

  public static rotateAxes(aboutCurrentZ: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isActive)
      return; // Require compass to already be active for this shortcut...

    if (accudraw.clearTentative() || IModelApp.accuSnap.isHot ||
      (CompassMode.Polar === accudraw.compassMode && accudraw.getFieldLock(ItemField.ANGLE_Item)) ||
      (CompassMode.Polar !== accudraw.compassMode && accudraw.getFieldLock(ItemField.X_Item) && accudraw.getFieldLock(ItemField.Y_Item))) {
      if (AccuDrawShortcuts.rotateAxesByPoint(true, aboutCurrentZ)) {
        AccuDrawShortcuts.itemFieldUnlockAll();
        accudraw.refreshDecorationsAndDynamics();
        return;
      }
    }
    AccuDrawTool.installTool(new RotateAxesTool(aboutCurrentZ));
  }

  public static rotateToElement(updateCurrentACS: boolean): void {
    const accudraw = IModelApp.accuDraw;
    if (!accudraw.isEnabled)
      return;

    const moveOrigin = !accudraw.isActive; // Leave current origin if AccuDraw is already enabled...
    AccuDrawTool.installTool(new RotateElementTool(moveOrigin, updateCurrentACS, false));
  }

  public static defineACSByElement(): void {
    AccuDrawTool.installTool(new RotateElementTool(true, true, true));
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
        const acs = currentACS.clone<AuxCoordSystemState>();

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

class AccuDrawShortcutsTool extends InputCollector {
  public static toolId = "View.AccuDraw";
  private _cancel: boolean;
  private _shortcut: AccuDrawTool;

  public constructor(shortcut: AccuDrawTool) { super(); this._shortcut = shortcut; this._cancel = true; }
  public onPostInstall(): void { super.onPostInstall(); this._shortcut.doManipulationStart(); }
  public onCleanup(): void { this._shortcut.doManipulationStop(this._cancel); }
  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> { if (await this._shortcut.doManipulation(ev, false)) { this._cancel = false; this.exitTool(); } return EventHandled.No; }
  public async onMouseMotion(ev: BeButtonEvent): Promise<void> { this._shortcut.doManipulation(ev, true); }
  public decorate(context: DecorateContext) { this._shortcut.onDecorate(context); }
  public exitTool() { super.exitTool(); AccuDrawShortcuts.requestInputFocus(); } // re-grab focus when auto-focus tool setting set...
}

export abstract class AccuDrawTool {
  public doManipulationStart() {
    const toolAdmin = IModelApp.toolAdmin;

    // NOTE: Unlike starting a viewing tool, the input collector inherits the suspended primitive's state and must set everything...
    toolAdmin.setLocateCursor(false);
    toolAdmin.toolState.coordLockOvr = CoordinateLockOverrides.None;

    const accuSnap = IModelApp.accuSnap;
    accuSnap.enableLocate(false);
    accuSnap.enableSnap(true);

    if (this.activateAccuDrawOnStart())
      IModelApp.accuDraw.activate();

    this.doManipulation(undefined, true);
  }

  public doManipulationStop(cancel: boolean) {
    if (!cancel)
      IModelApp.accuDraw.savedStateInputCollector.ignoreFlags = this.onManipulationComplete();
  }

  public activateAccuDrawOnStart() { return true; }
  public abstract async doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): Promise<boolean>;
  public onManipulationComplete(): AccuDrawFlags { return 0; }
  public onDecorate(_context: DecorateContext) { }
  public static installTool(shortcut: AccuDrawTool): boolean { return new AccuDrawShortcutsTool(shortcut).run(); }
  public static outputPrompt(messageKey: string) { IModelApp.notifications.outputPromptByKey("AccuDraw.Prompt." + messageKey); }
}

class RotateAxesTool extends AccuDrawTool {
  constructor(private _aboutCurrentZ: boolean) { super(); }
  public onManipulationComplete(): AccuDrawFlags { return AccuDrawFlags.SetRMatrix; }
  public doManipulationStart(): void {
    super.doManipulationStart();
    AccuDrawTool.outputPrompt("DefineXAxis");
  }
  public async doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): Promise<boolean> {
    const vp = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (!vp)
      return true;
    AccuDrawShortcuts.rotateAxesByPoint(TentativeOrAccuSnap.isHot, this._aboutCurrentZ);
    vp.invalidateDecorations();
    if (!isMotion)
      AccuDrawShortcuts.itemFieldUnlockAll();
    return true;
  }
}

class RotateElementTool extends AccuDrawTool {
  constructor(private _moveOrigin: boolean, private _updateCurrentACS: boolean, private _updateDynamicACS: boolean) { super(); }
  public activateAccuDrawOnStart(): boolean { return !this._updateDynamicACS; }

  public onManipulationComplete(): AccuDrawFlags {
    let ignoreFlags = AccuDrawFlags.SetRMatrix;

    if (this._moveOrigin)
      ignoreFlags |= AccuDrawFlags.SetOrigin;

    if (!this._updateDynamicACS)
      ignoreFlags |= AccuDrawFlags.Disable; // If AccuDraw wasn't active when the shortcut started, let it remain active for suspended tool when shortcut completes...

    return ignoreFlags;
  }

  public doManipulationStart(): void {
    super.doManipulationStart();
    AccuDrawTool.outputPrompt("DefineElem");
    const accuSnap = IModelApp.accuSnap;
    if (!accuSnap.isSnapEnabledByUser)
      accuSnap.enableLocate(true); // If user doesn't want AccuSnap, tool can work with just auto-locate...
  }

  public updateOrientation(snap: SnapDetail, vp: Viewport): boolean {
    const accudraw = IModelApp.accuDraw;
    const rMatrix = AccuDraw.getSnapRotation(snap, vp);
    if (undefined === rMatrix)
      return false;

    const origin = this._moveOrigin ? snap.snapPoint : accudraw.origin;
    accudraw.setContext(AccuDrawFlags.AlwaysSetOrigin | AccuDrawFlags.SetRMatrix, origin, rMatrix);

    return true;
  }

  public async doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): Promise<boolean> {
    const vp = ev ? ev.viewport : IModelApp.accuDraw.currentView;
    if (!vp)
      return true;

    let snapDetail = TentativeOrAccuSnap.getCurrentSnap(false);

    if (undefined === snapDetail) {
      const accuSnap = IModelApp.accuSnap;
      const hitDetail = accuSnap.currHit;

      // Turn hit into nearest snap when shortcut was started without AccuSnap being user enabled...
      if (undefined !== hitDetail)
        snapDetail = await AccuSnap.requestSnap(hitDetail, [SnapMode.Nearest], IModelApp.locateManager.apertureInches, 1);
    }

    if (undefined !== snapDetail && !this.updateOrientation(snapDetail, vp))
      return true;

    if (this._updateDynamicACS)
      IModelApp.viewManager.invalidateDecorationsAllViews();
    else if (undefined === ev)
      AccuDrawShortcuts.processPendingHints();

    if (isMotion)
      return true;

    const accudraw = IModelApp.accuDraw;
    if (this._updateCurrentACS) {
      AccuDrawShortcuts.processPendingHints();

      const currentACS = vp.view.auxiliaryCoordinateSystem;
      const acs = currentACS.clone<AuxCoordSystemState>();

      acs.setOrigin(accudraw.origin);
      acs.setRotation(accudraw.getRotation());

      AccuDraw.updateAuxCoordinateSystem(acs, vp);
    } else {
      accudraw.changeBaseRotationMode(RotationMode.Context); // Hold temporary rotation for tool duration when not updating ACS...
    }

    return true;
  }

  public onDecorate(context: DecorateContext): void {
    if (!this._updateDynamicACS)
      return;

    const accudraw = IModelApp.accuDraw;
    const origin = accudraw.origin;
    const rMatrix = accudraw.getRotation();
    const acs = context.viewport!.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();
    acs.setOrigin(origin);
    acs.setRotation(rMatrix);
    acs.display(context, ACSDisplayOptions.Active | ACSDisplayOptions.Dynamics);
  }
}

class DefineACSByPointsTool extends AccuDrawTool {
  private readonly _points: Point3d[] = [];
  private _acs?: AuxCoordSystemState;

  public activateAccuDrawOnStart(): boolean { return false; }
  public onManipulationComplete(): AccuDrawFlags { return AccuDrawFlags.SetRMatrix; }

  public doManipulationStart(): void {
    super.doManipulationStart();

    const tentativePoint = IModelApp.tentativePoint;
    if (!tentativePoint.isActive) {
      AccuDrawTool.outputPrompt("DefineOrigin");
      return;
    }

    const origin = tentativePoint.getPoint().clone();
    AccuDrawTool.outputPrompt("DefineXAxis");
    IModelApp.accuDraw.setContext(AccuDrawFlags.SetOrigin | AccuDrawFlags.FixedOrigin, origin);
    this._points.push(origin);
    tentativePoint.clear(true);
  }

  public async doManipulation(ev: BeButtonEvent | undefined, isMotion: boolean): Promise<boolean> {
    if (!ev || !ev.viewport)
      return true;

    IModelApp.viewManager.invalidateDecorationsAllViews();
    if (isMotion)
      return false;

    IModelApp.accuDraw.activate();
    this._points.push(ev.point.clone());

    const vp = ev.viewport;
    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();

    if (AccuDrawShortcuts.updateACSByPoints(this._acs, vp, this._points, false)) {
      AccuDraw.updateAuxCoordinateSystem(this._acs, vp);
      AccuDrawShortcuts.rotateToACS();
      return true;
    }

    AccuDrawTool.outputPrompt(1 === this._points.length ? "DefineXAxis" : "DefineYDir");
    return false;
  }

  public onDecorate(context: DecorateContext): void {
    const tmpPoints: Point3d[] = [];
    this._points.forEach((pt) => tmpPoints.push(pt));

    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    tmpPoints.push(ev.point);

    const vp = context.viewport!;
    if (!this._acs)
      this._acs = vp.view.auxiliaryCoordinateSystem.clone<AuxCoordSystemState>();

    AccuDrawShortcuts.updateACSByPoints(this._acs, vp, tmpPoints, true);
    this._acs.display(context, ACSDisplayOptions.Active | ACSDisplayOptions.Dynamics);
  }
}
