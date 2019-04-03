/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import { IModelApp, Viewport, SelectedViewportChangedArgs, StandardViewId } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";
import { Matrix3d, Point3d, Vector3d } from "@bentley/geometry-core";

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
  animationTime?: number;
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

    if (IModelApp.viewManager)  // Not set in unit test environment
      this._removeListener = IModelApp.viewManager.onSelectedViewportChanged.addListener(ViewportComponentEvents.handleSelectedViewportChanged);
  }

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

  public static setCubeMatrix(rotMatrix: Matrix3d, animationTime?: number): void {
    this.rotationMatrix.setFrom(rotMatrix);
    this.onCubeRotationChangeEvent.emit({ rotMatrix, animationTime });
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
      this.origin.setFrom(viewport.view.getOrigin());
      this.extents.setFrom(viewport.view.getExtents());
      this.rotationMatrix.setFrom(viewport.rotation);
      this.onViewRotationChangeEvent.emit({ viewport, animationTime });
    });
  }
}
