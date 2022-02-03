/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Viewport
 */

import { Matrix3d, Point3d, Vector3d } from "@itwin/core-geometry";
import type { SelectedViewportChangedArgs, StandardViewId, Viewport } from "@itwin/core-frontend";
import { IModelApp } from "@itwin/core-frontend";
import { UiEvent } from "@itwin/appui-abstract";
import { Face } from "../navigationaids/Cube";

/** Arguments for [[DrawingViewportChangeEvent]]
 * @public
 */
export interface DrawingViewportChangeEventArgs {
  rotation: Matrix3d;
  origin: Point3d;
  complete: boolean;
}

/** Drawing View Change event
 * @public
 */
export class DrawingViewportChangeEvent extends UiEvent<DrawingViewportChangeEventArgs> { }

/** Arguments for [[CubeRotationChangeEvent]]
 * @public
 */
export interface CubeRotationChangeEventArgs {
  rotMatrix: Matrix3d;
  face: Face;
  complete?: boolean;
}

/** 3d Cube Rotation Change event
 * @public
 */
export class CubeRotationChangeEvent extends UiEvent<CubeRotationChangeEventArgs> { }

/** Arguments for [[StandardRotationChangeEvent]]
 * @public
 */
export interface StandardRotationChangeEventArgs {
  standardRotation: StandardViewId;
}

/** Standard Rotation Change event
 * @public
 */
export class StandardRotationChangeEvent extends UiEvent<StandardRotationChangeEventArgs> { }

/** Arguments for [[ViewRotationChangeEvent]]
 * @public
 */
export interface ViewRotationChangeEventArgs {
  viewport: Viewport;
  animationTime?: number;
}

/** View Rotation Change event
 * @public
 */
export class ViewRotationChangeEvent extends UiEvent<ViewRotationChangeEventArgs> { }

/** Arguments for [[ViewClassFullNameChangedEvent]]
 * @public
 */
export interface ViewClassFullNameChangedEventArgs {
  viewport: Viewport;
  oldName: string;
  newName: string;
}

/** View Class Full Name Change event
 * @public
 */
export class ViewClassFullNameChangedEvent extends UiEvent<ViewClassFullNameChangedEventArgs> { }

/** Arguments for [[ViewIdChangedEvent]]
 * @public
 */
export interface ViewIdChangedEventArgs {
  viewport: Viewport;
  oldId: string;
  newId: string;
}

/** View Id Change event
 * @public
 */
export class ViewIdChangedEvent extends UiEvent<ViewIdChangedEventArgs> { }

/** Viewport Rotation events and methods
 * @public
 */
export class ViewportComponentEvents {
  private static _removeListener?: () => void;

  public static initialize() {
    if (undefined !== this._removeListener)
      return;

    this._removeListener = IModelApp.viewManager.onSelectedViewportChanged.addListener(ViewportComponentEvents.handleSelectedViewportChanged);
  }

  /** @internal - for unit testing */
  public static terminate() {
    if (this._removeListener) {
      this._removeListener();
      this._removeListener = undefined;
    }
  }

  public static face = Face.None;
  public static readonly origin = Point3d.createZero();
  public static readonly extents = Vector3d.createZero();
  public static readonly rotationMatrix = Matrix3d.createIdentity();
  public static readonly onDrawingViewportChangeEvent = new DrawingViewportChangeEvent();
  public static readonly onCubeRotationChangeEvent = new CubeRotationChangeEvent();
  public static readonly onStandardRotationChangeEvent = new StandardRotationChangeEvent();
  public static readonly onViewRotationChangeEvent = new ViewRotationChangeEvent();
  public static readonly onViewClassFullNameChangedEvent = new ViewClassFullNameChangedEvent();
  public static readonly onViewIdChangedEvent = new ViewIdChangedEvent();

  private static handleSelectedViewportChanged(args: SelectedViewportChangedArgs): void {
    if (args.current)
      ViewportComponentEvents.setViewMatrix(args.current);
  }

  public static setCubeMatrix(rotMatrix: Matrix3d, face = Face.None, complete: boolean = false): void {
    this.rotationMatrix.setFrom(rotMatrix);
    this.face = face;
    this.onCubeRotationChangeEvent.emit({ rotMatrix, complete, face });
  }

  public static setDrawingViewportState(origin: Point3d, rotation: Matrix3d, complete: boolean = false): void {
    this.onDrawingViewportChangeEvent.emit({ origin, rotation, complete });
  }

  public static setStandardRotation(standardRotation: StandardViewId): void {
    this.onStandardRotationChangeEvent.emit({ standardRotation });
  }

  public static setViewMatrix(viewport: Viewport, animationTime?: number): void {
    // When handling onViewChanged, use setTimeout
    setTimeout(() => {
      if (viewport.view) {
        this.origin.setFrom(viewport.view.getOrigin());
        this.extents.setFrom(viewport.view.getExtents());
      }
      this.rotationMatrix.setFrom(viewport.rotation);

      this.onViewRotationChangeEvent.emit({ viewport, animationTime });
    });
  }
}
