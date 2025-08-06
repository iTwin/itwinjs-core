/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Id64String } from "@itwin/core-bentley";
import { System } from "./System";
import { CesiumScene } from "./Scene";
import { Decorations, GraphicList, Pixel, RenderPlan, RenderTarget, Scene, ViewRect } from "@itwin/core-frontend";

// import { RenderPlan } from "@itwin/core-frontend/src/internal/render/RenderPlan";
// // eslint-disable-next-line @itwin/import-within-package
// import { RenderPlan } from "../../../../../core/frontend/src/internal/render/RenderPlan";

/** A Target that renders to a canvas on the screen using Cesium.
 * @internal
 */
export class OnScreenTarget extends RenderTarget {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _scene: CesiumScene;

  public get renderSystem(): System { return System.instance; }

  public get viewRect(): ViewRect {
    // ###TODO consider this a temporary solution until we have a proper ViewRect implementation for Cesium.
    const viewRect = new ViewRect();
    viewRect.init(0, 0, this._canvas.width, this._canvas.height);
    return viewRect;
  }

  public constructor(canvas: HTMLCanvasElement) {
    console.log("creating Cesium OnScreenTarget...");
    super();
    this._canvas = canvas;
    this._scene = new CesiumScene({
      canvas: this._canvas,
      sceneOptions: {
      }
    });
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(_decorations: Decorations) {
    // ###TODO Implement decoration change logic for Cesium
  }

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}

/** A Target that renders to an offscreen buffer using Cesium.
 * @internal
 */
export class OffScreenTarget extends RenderTarget {
  private readonly _rect: ViewRect

  public get renderSystem(): System { return System.instance; }

  public get viewRect(): ViewRect {
    return this._rect;
  }

  public constructor(rect: ViewRect) {
    super();
    this._rect = rect;
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(_decorations: Decorations) {
    // ###TODO Implement decoration change logic for Cesium
  }

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}
