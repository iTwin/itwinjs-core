/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Viewport */

import { IModelApp, Viewport } from "@bentley/imodeljs-frontend";
import { StandardViewId } from "@bentley/imodeljs-frontend";
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

    this._removeListener = IModelApp.viewManager.onSelectedViewportChanged.addListener((args) => {
      setImmediate(() => {
        if (args.current) {
          ViewRotationCube.setViewMatrix(args.current);
        }
      });
    });
  }

  public static readonly rMatrix = Matrix3d.createIdentity();
  public static readonly cubeRotationChangeEvent = new CubeRotationChangeEvent();
  public static readonly standardRotationChangeEvent = new StandardRotationChangeEvent();
  public static readonly viewRotationChangeEvent = new ViewRotationChangeEvent();

  public static setCubeMatrix(rotMatrix: Matrix3d, animationTime?: number): void {
    this.rMatrix.setFrom(rotMatrix);
    this.cubeRotationChangeEvent.emit({ rotMatrix, animationTime });
  }

  public static setStandardRotation(standardRotation: StandardViewId): void {
    this.standardRotationChangeEvent.emit({ standardRotation });
  }

  public static setViewMatrix(viewport: Viewport, animationTime?: number): void {
    this.rMatrix.setFrom(viewport.rotation);
    this.viewRotationChangeEvent.emit({ viewport, animationTime });
  }
}
