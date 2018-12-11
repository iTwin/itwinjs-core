/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import { IModelApp, Viewport, SelectedViewportChangedArgs, StandardViewId } from "@bentley/imodeljs-frontend";
import { UiEvent } from "@bentley/ui-core";
import { Matrix3d } from "@bentley/geometry-core";

/** Arguments for [[CubeRotationChangeEvent]] */
export interface CubeRotationChangeEventArgs {
  rotMatrix: Matrix3d;
  animationTime?: number;
}

/** 3d Cube Rotation Change event */
export class CubeRotationChangeEvent extends UiEvent<CubeRotationChangeEventArgs> { }

/** Arguments for [[StandardRotationChangeEvent]] */
export interface StandardRotationChangeEventArgs {
  standardRotation: StandardViewId;
}

/** Standard Rotation Change event */
export class StandardRotationChangeEvent extends UiEvent<StandardRotationChangeEventArgs> { }

/** Arguments for [[ViewRotationChangeEvent]] */
export interface ViewRotationChangeEventArgs {
  viewport: Viewport;
  animationTime?: number;
}

/** View Rotation Change event */
export class ViewRotationChangeEvent extends UiEvent<ViewRotationChangeEventArgs> { }

/** View Rotation events and methods */
export class ViewRotationCube {
  private static _removeListener?: () => void;

  public static initialize() {
    if (undefined !== this._removeListener)
      return;

    if (IModelApp.viewManager)  // Not set in unit test environment
      this._removeListener = IModelApp.viewManager.onSelectedViewportChanged.addListener(ViewRotationCube.handleSelectedViewportChanged);
  }

  public static readonly rMatrix = Matrix3d.createIdentity();
  public static readonly onCubeRotationChangeEvent = new CubeRotationChangeEvent();
  public static readonly onStandardRotationChangeEvent = new StandardRotationChangeEvent();
  public static readonly onViewRotationChangeEvent = new ViewRotationChangeEvent();

  private static handleSelectedViewportChanged(args: SelectedViewportChangedArgs): void {
    if (args.current)
      ViewRotationCube.setViewMatrix(args.current);
  }

  public static setCubeMatrix(rotMatrix: Matrix3d, animationTime?: number): void {
    setImmediate(() => {
      this.rMatrix.setFrom(rotMatrix);
      this.onCubeRotationChangeEvent.emit({ rotMatrix, animationTime });
    });
  }

  public static setStandardRotation(standardRotation: StandardViewId): void {
    setImmediate(() => {
      this.onStandardRotationChangeEvent.emit({ standardRotation });
    });
  }

  public static setViewMatrix(viewport: Viewport, animationTime?: number): void {
    setImmediate(() => {
      this.rMatrix.setFrom(viewport.rotation);
      this.onViewRotationChangeEvent.emit({ viewport, animationTime });
    });
  }
}
