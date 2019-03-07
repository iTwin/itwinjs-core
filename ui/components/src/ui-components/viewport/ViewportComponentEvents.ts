/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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

/** Arguments for [[ViewClassFullNameChangedEvent]] */
export interface ViewClassFullNameChangedEventArgs {
  viewport: Viewport;
  oldName: string;
  newName: string;
}

/** View Class Full Name Change event */
export class ViewClassFullNameChangedEvent extends UiEvent<ViewClassFullNameChangedEventArgs> { }

/** Arguments for [[ViewIdChangedEvent]] */
export interface ViewIdChangedEventArgs {
  viewport: Viewport;
  oldId: string;
  newId: string;
}

/** View Id Change event */
export class ViewIdChangedEvent extends UiEvent<ViewIdChangedEventArgs> { }

/** Viewport Rotation events and methods */
export class ViewportComponentEvents {
  private static _removeListener?: () => void;

  public static initialize() {
    if (undefined !== this._removeListener)
      return;

    if (IModelApp.viewManager)  // Not set in unit test environment
      this._removeListener = IModelApp.viewManager.onSelectedViewportChanged.addListener(ViewportComponentEvents.handleSelectedViewportChanged);
  }

  public static readonly rMatrix = Matrix3d.createIdentity();
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
    this.rMatrix.setFrom(rotMatrix);
    this.onCubeRotationChangeEvent.emit({ rotMatrix, animationTime });
  }

  public static setStandardRotation(standardRotation: StandardViewId): void {
    this.onStandardRotationChangeEvent.emit({ standardRotation });
  }

  public static setViewMatrix(viewport: Viewport, animationTime?: number): void {
    // When handling onViewChanged, use setTimeout
    setTimeout(() => {
      this.rMatrix.setFrom(viewport.rotation);
      this.onViewRotationChangeEvent.emit({ viewport, animationTime });
    });
  }
}
